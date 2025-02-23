import { type } from 'arktype';
import { boards } from 'db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';

const bodySchema = type({ id: 'string' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ message: body.summary, statusCode: 400 });
	}

	const board = await db.transaction(async (tx) => {
		const [deletedBoard] = await tx
			.delete(boards)
			.where(and(eq(boards.id, body.id), eq(boards.userId, user.id)))
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

	if (!board) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

	return board;
});
