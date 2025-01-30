import { boards } from 'db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { type } from 'arktype';

const bodySchema = type({ id: 'string' });
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ statusCode: 400, message: body.summary });
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
