import { type } from 'arktype';
import { boards } from 'db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';

const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const result = await getValidatedRouterParams(event, paramsSchema);
	if (result instanceof type.errors) {
		throw createError({ message: result.summary, statusCode: 400 });
	}
	const { id } = result;

	const board = await db.transaction(async (tx) => {
		const [deletedBoard] = await tx
			.delete(boards)
			.where(and(eq(boards.id, id), eq(boards.userId, user.id)))
			.returning();

		if (!deletedBoard) return deletedBoard;
		await tx
			.update(boards)
			.set({ index: sql`${boards.index} - 1` })
			.where(
				and(
					eq(boards.userId, user.id),
					gt(boards.index, deletedBoard.index),
					eq(boards.nodeId, deletedBoard.nodeId)
				)
			);
		return deletedBoard;
	});

	if (!board) throw createError({ statusCode: 404 });
	const path = await getPathByNodeId(board.nodeId, user.id);

	return { board, path };
});
