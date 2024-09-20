import { action, cache, redirect } from '@solidjs/router';
import { and, eq, gt, gte, inArray, lt, lte, SQL, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '~/db';
import { type TBoard, type TTask, tasks } from '~/db/schema';
import { getUser } from '~/utils/auth.server';
import { createNotifier } from '~/utils/publish';

const getTasks = cache(async function () {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');

	const $tasks = await db.select().from(tasks).where(eq(tasks.userId, user.id));
	return $tasks;
}, 'get-tasks');

const moveTasks = async (
	inputs: Array<{ id: TTask['id']; boardId: TBoard['id']; index: number }>
) => {
	'use server';
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

	if (inputs.length === 0) throw new Error('No tasks to move');
	console.log(inputs);
	const ids = inputs.map((input) => input.id);

	await db.transaction(async (tx) => {
		await db
			.update(tasks)
			.set({
				index: sql.join(
					[
						sql`(case`,
						...inputs.map(
							(input) => sql`when ${tasks.id} = ${input.id} then ${input.index + 10000}`
						),
						sql`end)`
					],
					sql.raw(' ')
				),
				boardId: sql.join(
					[
						sql`(case`,
						...inputs.map((input) => sql`when ${tasks.id} = ${input.id} then ${input.boardId}`),
						sql`end)`
					],
					sql.raw(' ')
				)
			})
			.where(inArray(tasks.id, ids));
		await db
			.update(tasks)
			.set({
				index: sql`${tasks.index} - 10000`
			})
			.where(inArray(tasks.id, ids));
	});
};

const shiftTask = async (taskId: TTask['id'], direction: 1 | -1) => {
	'use server';

	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

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
		{ id: task.id, boardId: task.boardId, index: task.index + direction },
		{ id: siblingTask.id, boardId: siblingTask.boardId, index: task.index }
	]);
};

const createTask = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

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
		.values({ id, index, title, boardId, userId: user.id })
		.returning();

	void notify({ type: 'create', id: task.id, data: task }, publisherId);
	return task;
}, 'create-task');

const updateTask = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const id = String(formData.get('id')).trim();
	const title = String(formData.get('title')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	const [$task] = await db
		.update(tasks)
		.set({ title })
		.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
		.returning();
	void notify({ type: 'update', id: $task.id, data: $task }, publisherId);
	return $task;
}, 'update-task');

const deleteTask = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

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
	void notify({ type: 'delete', id: taskId }, publisherId);
	return;
}, 'delete-task');

const notify = createNotifier('tasks');

export { createTask, deleteTask, getTasks, moveTasks, shiftTask, updateTask };
