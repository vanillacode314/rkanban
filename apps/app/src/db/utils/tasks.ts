import { action, cache, redirect } from '@solidjs/router';
import { and, eq, gt, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRequestEvent } from 'solid-js/web';
import { db } from '~/db';
import { type TBoard, type TTask, tasks } from '~/db/schema';
import { getUser } from '~/utils/auth.server';

const getTasks = cache(async function () {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');

	const $tasks = await db.select().from(tasks).where(eq(tasks.userId, user.id));
	return $tasks;
}, 'get-tasks');

const moveTask = async (taskId: TTask['id'], toBoardId: TBoard['id'], toIndex?: TTask['index']) => {
	'use server';
	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
	if (!task) throw new Error('Task not found');

	const fromIndex = task.index;

	if (task.boardId === toBoardId) {
		if (toIndex === undefined) throw new Error('Need index to move inside same task');
		await db.transaction(async (tx) => {
			let ids: string[] = [];
			let z;
			if (fromIndex > toIndex!) {
				ids = await tx
					.update(tasks)
					.set({ index: sql`${tasks.index} + 1 + 10000` })
					.where(
						and(
							eq(tasks.boardId, toBoardId),
							eq(tasks.userId, user.id),
							lt(tasks.index, fromIndex),
							gte(tasks.index, toIndex!)
						)
					)
					.returning({ id: tasks.id })
					.then((tasks) => tasks.map((task) => task.id));
			} else {
				ids = await tx
					.update(tasks)
					.set({ index: sql`${tasks.index} - 1 + 10000` })
					.where(
						and(
							eq(tasks.boardId, toBoardId),
							eq(tasks.userId, user.id),
							gt(tasks.index, fromIndex),
							lte(tasks.index, toIndex!)
						)
					)
					.returning({ id: tasks.id })
					.then((tasks) => tasks.map((task) => task.id));
			}
			await tx
				.update(tasks)
				.set({ index: toIndex })
				.where(
					and(eq(tasks.boardId, task.boardId), eq(tasks.userId, user.id), eq(tasks.id, taskId))
				);
			await tx
				.update(tasks)
				.set({ index: sql`${tasks.index} - 10000` })
				.where(
					and(eq(tasks.boardId, toBoardId), eq(tasks.userId, user.id), inArray(tasks.id, ids))
				);
		});
		return;
	}

	{
		const [task] = await db
			.select({ maxIndex: sql<number>`max(${tasks.index})` })
			.from(tasks)
			.where(and(eq(tasks.boardId, toBoardId), eq(tasks.userId, user.id)));
		if (null === task.maxIndex) toIndex = 0;
		else toIndex = task.maxIndex + 1;
	}

	await db
		.update(tasks)
		.set({ boardId: toBoardId, index: toIndex })
		.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
	return task;
};

const shiftTask = async (taskId: TTask['id'], direction: 1 | -1) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

	const [task] = await db
		.select({ index: tasks.index })
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
	await db.batch([
		db
			.update(tasks)
			.set({ index: task.index + direction + 10000 })
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id))),
		db
			.update(tasks)
			.set({ index: task.index })
			.where(and(eq(tasks.index, task.index + direction), eq(tasks.userId, user.id))),
		db
			.update(tasks)
			.set({ index: task.index + direction })
			.where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
	]);
};

const createTask = action(async (formData: FormData) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const title = String(formData.get('title')).trim();
	const boardId = String(formData.get('boardId')).trim();
	const id = String(formData.get('id') ?? nanoid()).trim();

	let index;
	{
		const [task] = await db
			.select({ maxIndex: sql<number>`max(${tasks.index})` })
			.from(tasks)
			.where(and(eq(tasks.boardId, boardId), eq(tasks.userId, user.id)));
		if (null === task.maxIndex) index = 0;
		else index = task.maxIndex + 1;
	}
	const task = await db
		.insert(tasks)
		.values({ id, index, title, boardId, userId: user.id })
		.returning();
	return task;
}, 'create-task');

const updateTask = action(async (formData: FormData) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const id = String(formData.get('id')).trim();
	const title = String(formData.get('title')).trim();

	const $task = await db
		.update(tasks)
		.set({ title })
		.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
		.returning();
	return $task;
}, 'update-task');

const deleteTask = action(async (formData: FormData) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const taskId = String(formData.get('id')).trim();
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
}, 'delete-task');

export { createTask, deleteTask, getTasks, moveTask, shiftTask, updateTask };
