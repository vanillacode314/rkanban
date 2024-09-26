import { action, cache } from '@solidjs/router';
import { tasks, type TBoard, type TTask } from 'db/schema';
import { and, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { checkUser } from '~/utils/auth.server';
import { createNotifier } from '~/utils/publish';

import { db } from './..';

const getTasks = cache(async function () {
	'use server';

	const user = await checkUser();

	const $tasks = await db.select().from(tasks).where(eq(tasks.userId, user.id));
	return $tasks;
}, 'get-tasks');

const moveTasks = async (
	inputs: Array<{ boardId: TBoard['id']; id: TTask['id']; index: number }>
) => {
	'use server';
	const user = await checkUser();

	if (inputs.length === 0) throw new Error('No tasks to move');
	const ids = inputs.map((input) => input.id);

	await db.transaction(async (tx) => {
		await tx
			.update(tasks)
			.set({
				boardId: sql.join(
					[
						sql`(case`,
						...inputs.map((input) => sql`when ${tasks.id} = ${input.id} then ${input.boardId}`),
						sql`end)`
					],
					sql.raw(' ')
				),
				index: sql.join(
					[
						sql`(case`,
						...inputs.map(
							(input) => sql`when ${tasks.id} = ${input.id} then ${input.index + 10000}`
						),
						sql`end)`
					],
					sql.raw(' ')
				)
			})
			.where(and(inArray(tasks.id, ids), eq(tasks.userId, user.id)));
		await tx
			.update(tasks)
			.set({
				index: sql`${tasks.index} - 10000`
			})
			.where(and(inArray(tasks.id, ids), eq(tasks.userId, user.id)));
	});
};

const changeBoard = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const id = String(formData.get('id')).trim();
	const boardId = String(formData.get('boardId')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

	const [newIndex, tasksToUpdate] = await Promise.all([
		db
			.select({ count: count() })
			.from(tasks)
			.where(and(eq(tasks.userId, user.id), eq(tasks.boardId, boardId)))
			.then((results) => results[0].count),
		db
			.select({ id: tasks.id, title: tasks.title })
			.from(tasks)
			.where(
				and(eq(tasks.userId, user.id), gt(tasks.index, task.index), eq(tasks.boardId, task.boardId))
			)
	]);

	await db.transaction(async (tx) => {
		await tx
			.update(tasks)
			.set({ boardId, index: newIndex })
			.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
		await tx
			.update(tasks)
			.set({ index: sql`${tasks.index} + 10000 - 1` })
			.where(
				and(
					inArray(
						tasks.id,
						tasksToUpdate.map((t) => t.id)
					),
					eq(tasks.userId, user.id)
				)
			);
		await tx
			.update(tasks)
			.set({ index: sql`${tasks.index} - 10000` })
			.where(
				and(
					inArray(
						tasks.id,
						tasksToUpdate.map((t) => t.id)
					),
					eq(tasks.userId, user.id)
				)
			);
	});

	void notify({ id, type: 'update' }, publisherId);
}, 'change-board');

const shiftTask = async (taskId: TTask['id'], direction: -1 | 1) => {
	'use server';

	const user = await checkUser();

	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

	if (direction === 1) {
		const [{ maxIndex }] = await db
			.select({ maxIndex: sql<number>`max(${tasks.index})` })
			.from(tasks)
			.where(eq(tasks.userId, user.id));
		if (maxIndex === task.index) throw new Error('Can not shift last task');
	} else if (0 === task.index) {
		throw new Error('Can not shift first task');
	}

	const [siblingTask] = await db
		.select()
		.from(tasks)
		.where(
			and(
				eq(tasks.index, task.index + direction),
				eq(tasks.boardId, task.boardId),
				eq(tasks.userId, user.id)
			)
		);

	await moveTasks([
		{ boardId: task.boardId, id: task.id, index: task.index + direction },
		{ boardId: siblingTask.boardId, id: siblingTask.id, index: task.index }
	]);
};

const createTask = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const title = String(formData.get('title')).trim();
	const boardId = String(formData.get('boardId')).trim();
	const id = String(formData.get('id') ?? nanoid()).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	let index;
	{
		const [task] = await db
			.select({ maxIndex: sql<number>`max(${tasks.index})` })
			.from(tasks)
			.where(and(eq(tasks.boardId, boardId), eq(tasks.userId, user.id)));
		if (null === task.maxIndex) index = 0;
		else index = task.maxIndex + 1;
	}
	const [task] = await db
		.insert(tasks)
		.values({ boardId, id, index, title, userId: user.id })
		.returning();

	void notify({ data: task, id: task.id, type: 'create' }, publisherId);
	return task;
}, 'create-task');

const updateTask = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const id = String(formData.get('id')).trim();
	const title = String(formData.get('title')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	const [$task] = await db
		.update(tasks)
		.set({ title })
		.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
		.returning();
	void notify({ data: $task, id: $task.id, type: 'update' }, publisherId);
	return $task;
}, 'update-task');

const deleteTask = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const taskId = String(formData.get('id')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	await db.transaction(async (tx) => {
		const [task] = await tx
			.delete(tasks)
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
			.returning();
		if (!task) return;
		await tx
			.update(tasks)
			.set({ index: sql`${tasks.index} - 1` })
			.where(
				and(eq(tasks.boardId, task.boardId), eq(tasks.userId, user.id), gt(tasks.index, task.index))
			);
	});
	void notify({ id: taskId, type: 'delete' }, publisherId);
	return;
}, 'delete-task');

const notify = createNotifier('tasks');

export { changeBoard, createTask, deleteTask, getTasks, moveTasks, shiftTask, updateTask };
