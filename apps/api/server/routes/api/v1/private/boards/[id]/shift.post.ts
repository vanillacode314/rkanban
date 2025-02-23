import { type } from 'arktype';
import { boards } from 'db/schema';
import { and, eq, gt, lt, sql } from 'drizzle-orm';

const TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES = 99999;

const bodySchema = type({ direction: 'number' });
const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);

	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ message: body.summary, statusCode: 400 });
	}
	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ message: params.summary, statusCode: 400 });
	}

	const [board] = await db
		.select()
		.from(boards)
		.where(and(eq(boards.id, params.id), eq(boards.userId, user.id)));
	if (!board) throw createError({ statusCode: 404 });

	const currentIndex = board.index;
	const maxIndex = await db
		.select({ maxIndex: sql<null | number>`max(${boards.index})` })
		.from(boards)
		.where(and(eq(boards.userId, user.id), eq(boards.nodeId, board.nodeId)))
		.then(([{ maxIndex }]) => maxIndex ?? 0);
	const newIndex = (currentIndex + body.direction) % (maxIndex + 1);
	if (newIndex === currentIndex) return 'Success';
	const realDifference = newIndex - currentIndex;
	const realDirection = Math.sign(realDifference);

	await db.batch([
		db
			.update(boards)
			.set({ index: newIndex + TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES })
			.where(and(eq(boards.id, params.id), eq(boards.userId, user.id))),
		db
			.update(boards)
			.set({
				index: sql`${boards.index} + ${-1 * realDirection} + ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(boards.userId, user.id),
					eq(boards.nodeId, board.nodeId),
					lt(boards.index, currentIndex).if(realDirection < 0),
					gt(boards.index, newIndex - 1).if(realDirection < 0),
					gt(boards.index, currentIndex).if(realDirection > 0),
					lt(boards.index, newIndex + 1).if(realDirection > 0)
				)
			),
		db
			.update(boards)
			.set({
				index: sql`${boards.index} - ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(boards.userId, user.id),
					eq(boards.nodeId, board.nodeId),
					gt(boards.index, TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES - 1)
				)
			)
	]);

	return 'Success';
});
