import { action, cache } from '@solidjs/router';
import { and, asc, eq, gt, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { boards, tasks, type TBoard, type TTask } from '~/db/schema';
import { getUser } from '~/utils/auth.server';
import { createNotifier } from '~/utils/publish';

import { db } from './..';
import { getNodes } from './nodes';

async function $getBoards(path: null): Promise<TBoard[]>;
async function $getBoards(path: string): Promise<Array<{ tasks: TTask[] } & TBoard>>;
async function $getBoards(path: null | string) {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;

	if (path === null) {
		const $boards = await db.select().from(boards).where(eq(boards.userId, user.id));
		return $boards;
	}

	const result = await getNodes(path);
	if (result instanceof Error) return result;
	const node = result.node;

	const rows = await db
		.select()
		.from(boards)
		.where(and(eq(boards.userId, user.id), eq(boards.nodeId, node.id)))
		.leftJoin(tasks, eq(boards.id, tasks.boardId))
		.orderBy(asc(boards.index), asc(tasks.index));

	const $boards: ({ tasks: TTask[] } & TBoard)[] = [];

	for (const row of rows) {
		const board = $boards.find((board) => board.id === row.boards.id);
		if (board) {
			if (row.tasks) board.tasks.push(row.tasks);
		} else {
			$boards.push({ ...row.boards, tasks: row.tasks ? [row.tasks] : [] });
		}
	}

	return $boards;
}
const getBoards = cache($getBoards, 'get-boards');

const moveBoards = async (inputs: Array<{ id: TBoard['id']; index: number }>) => {
	'use server';
	const user = (await getUser())!;

	if (inputs.length === 0) throw new Error('No boards to move');
	const ids = inputs.map((input) => input.id);
	console.log(inputs);

	await db.transaction(async () => {
		await db
			.update(boards)
			.set({
				index: sql.join(
					[
						sql`(case`,
						...inputs.map(
							(input) => sql`when ${boards.id} = ${input.id} then ${input.index + 10000}`
						),
						sql`end)`
					],
					sql.raw(' ')
				)
			})
			.where(and(inArray(boards.id, ids), eq(boards.userId, user.id)));
		await db
			.update(boards)
			.set({
				index: sql`${boards.index} - 10000`
			})
			.where(and(inArray(boards.id, ids), eq(boards.userId, user.id)));
	});
};

const shiftBoard = async (boardId: TBoard['id'], direction: -1 | 1) => {
	'use server';

	const user = (await getUser())!;

	const [board] = await db
		.select({ index: boards.index })
		.from(boards)
		.where(and(eq(boards.id, boardId), eq(boards.userId, user.id)));

	if (direction === 1) {
		const [{ maxIndex }] = await db
			.select({ maxIndex: sql<number>`max(${boards.index})` })
			.from(boards)
			.where(eq(boards.userId, user.id));
		if (maxIndex === board.index) throw new Error('Can not shift last board');
	} else if (0 === board.index) {
		throw new Error('Can not shift first board');
	}
	await db.batch([
		db
			.update(boards)
			.set({ index: board.index + direction + 10000 })
			.where(and(eq(boards.id, boardId), eq(boards.userId, user.id))),
		db
			.update(boards)
			.set({ index: board.index })
			.where(and(eq(boards.index, board.index + direction), eq(boards.userId, user.id))),
		db
			.update(boards)
			.set({ index: board.index + direction })
			.where(and(eq(boards.id, boardId), eq(boards.userId, user.id)))
	]);
};

const createBoard = action(async (formData: FormData) => {
	'use server';

	const user = (await getUser())!;

	const title = String(formData.get('title')).trim();
	const id = String(formData.get('id') ?? nanoid()).trim();
	const path = String(formData.get('path')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	const result = await getNodes(path);
	if (result instanceof Error) throw result;

	const node = result.node;

	let index;
	{
		const [board] = await db
			.select({ maxIndex: sql<number>`max(${boards.index})` })
			.from(boards)
			.where(and(eq(boards.userId, user.id), eq(boards.nodeId, node.id)));
		if (board.maxIndex === null) index = 0;
		else index = board.maxIndex + 1;
	}
	const [$board] = await db
		.insert(boards)
		.values({ id, index, nodeId: node.id, title: title, userId: user.id })
		.returning();

	void notify({ data: $board, id: $board.id, type: 'create' }, publisherId);
	return $board;
}, 'create-board');

const updateBoard = action(async (formData: FormData) => {
	'use server';

	const user = (await getUser())!;

	const id = String(formData.get('id')).trim();
	const title = String(formData.get('title')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	const [$board] = await db
		.update(boards)
		.set({ title: title })
		.where(and(eq(boards.id, id), eq(boards.userId, user.id)))
		.returning();

	void notify({ data: $board, id: $board.id, type: 'update' }, publisherId);
	return $board;
}, 'update-board');

const deleteBoard = action(async (formData: FormData) => {
	'use server';

	const user = (await getUser())!;

	const boardId = String(formData.get('id')).trim();
	const publisherId =
		formData.has('publisherId') ? String(formData.get('publisherId')).trim() : undefined;

	await db.transaction(async (tx) => {
		const [board] = await tx
			.delete(boards)
			.where(and(eq(boards.id, boardId), eq(boards.userId, user.id)))
			.returning();
		if (!board) return;
		await tx
			.update(boards)
			.set({ index: sql`${boards.index} - 1` })
			.where(
				and(
					eq(boards.userId, user.id),
					gt(boards.index, board.index),
					eq(boards.nodeId, board.nodeId)
				)
			);
	});

	void notify({ id: boardId, type: 'delete' }, publisherId);
}, 'delete-board');

const notify = createNotifier('boards');

export { createBoard, deleteBoard, getBoards, moveBoards, shiftBoard, updateBoard };
