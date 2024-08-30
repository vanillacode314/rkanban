import { action, cache, redirect } from '@solidjs/router';
import { and, asc, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRequestEvent } from 'solid-js/web';
import { db } from '~/db';
import { type TBoard, type TTask, boards, tasks, TNode } from '~/db/schema';
import { getUser } from '~/utils/auth.server';
import { getNodes } from './nodes';

const getBoards = cache(async (path: string) => {
	'use server';

	const user = (await getUser())!;

	let node: TNode;
	try {
		({ node } = await getNodes(path));
	} catch (e) {
		throw redirect('/');
	}

	const rows = await db
		.select()
		.from(boards)
		.where(and(eq(boards.userId, user.id), eq(boards.nodeId, node.id)))
		.leftJoin(tasks, and(eq(boards.id, tasks.boardId)))
		.orderBy(asc(boards.index), asc(tasks.index));

	const $boards: (TBoard & { tasks: TTask[] })[] = [];

	for (const row of rows) {
		const board = $boards.find((board) => board.id === row.boards.id);
		if (board) {
			if (row.tasks) board.tasks.push(row.tasks);
		} else {
			$boards.push({ ...row.boards, tasks: row.tasks ? [row.tasks] : [] });
		}
	}

	return $boards;
}, 'get-boards');

const moveBoard = async (boardId: TBoard['id'], toIndex: TBoard['index']) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

	const [board] = await db
		.select()
		.from(boards)
		.where(and(eq(boards.id, boardId), eq(boards.userId, user.id)));

	const fromIndex = board.index;
	if (fromIndex === toIndex) throw new Error(`Can't move board to same index`);
	await db.transaction(async (tx) => {
		if (fromIndex > toIndex) {
			await tx
				.update(boards)
				.set({ index: sql`${boards.index} + 1` })
				.where(
					and(eq(boards.userId, user.id), lt(boards.index, fromIndex), gte(boards.index, toIndex))
				);
		} else {
			await tx
				.update(boards)
				.set({ index: sql`${boards.index} - 1` })
				.where(
					and(eq(boards.userId, user.id), gt(boards.index, fromIndex), lte(boards.index, toIndex))
				);
		}
		await tx
			.update(boards)
			.set({ index: toIndex })
			.where(and(eq(boards.userId, user.id), eq(boards.id, boardId)));
	});
};

const shiftBoard = async (boardId: TBoard['id'], direction: 1 | -1) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');

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

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const title = String(formData.get('title')).trim();
	const id = String(formData.get('id') ?? nanoid()).trim();
	const path = String(formData.get('path')).trim();

	const { node } = await getNodes(path);

	let index;
	{
		const [board] = await db
			.select({ maxIndex: sql<number>`max(${boards.index})` })
			.from(boards)
			.where(and(eq(boards.userId, user.id), eq(boards.nodeId, node.id)));
		if (board.maxIndex === null) index = 0;
		else index = board.maxIndex + 1;
	}
	const $board = await db
		.insert(boards)
		.values({ id, index, title: title, userId: user.id, nodeId: node.id })
		.returning();

	return $board;
}, 'create-board');

const updateBoard = action(async (formData: FormData) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const id = String(formData.get('id')).trim();
	const title = String(formData.get('title')).trim();
	const $board = await db
		.update(boards)
		.set({ title: title })
		.where(and(eq(boards.id, id), eq(boards.userId, user.id)))
		.returning();

	return $board;
}, 'update-board');

const deleteBoard = action(async (formData: FormData) => {
	'use server';

	const event = getRequestEvent()!;
	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const boardId = String(formData.get('id')).trim();

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
}, 'delete-board');

export { createBoard, deleteBoard, getBoards, moveBoard, shiftBoard, updateBoard };
