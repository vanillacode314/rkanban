import { type } from 'arktype';
import { tasks } from 'db/schema';
import { gt, lt, and, eq, sql } from 'drizzle-orm';

const TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES = 99999;

const bodySchema = type({ direction: 'number' });
const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;

	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ statusCode: 400, message: body.summary });
	}
	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ statusCode: 400, message: params.summary });
	}

	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)));
	if (!task) throw createError({ statusCode: 404 });

	const currentIndex = task.index;
	const maxIndex = await db
		.select({ maxIndex: sql<null | number>`max(${tasks.index})` })
		.from(tasks)
		.where(and(eq(tasks.userId, user.id), eq(tasks.boardId, task.boardId)))
		.then(([{ maxIndex }]) => maxIndex ?? 0);
	const newIndex = (currentIndex + body.direction) % (maxIndex + 1);
	if (newIndex === currentIndex) return 'Success';
	const realDifference = newIndex - currentIndex;
	const realDirection = Math.sign(realDifference);

	await db.batch([
		db
			.update(tasks)
			.set({ index: newIndex + TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES })
			.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id))),
		db
			.update(tasks)
			.set({
				index: sql`${tasks.index} + ${-1 * realDirection} + ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(tasks.userId, user.id),
					eq(tasks.boardId, task.boardId),
					lt(tasks.index, currentIndex).if(realDirection < 0),
					gt(tasks.index, newIndex - 1).if(realDirection < 0),
					gt(tasks.index, currentIndex).if(realDirection > 0),
					lt(tasks.index, newIndex + 1).if(realDirection > 0)
				)
			),
		db
			.update(tasks)
			.set({
				index: sql`${tasks.index} - ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(tasks.userId, user.id),
					eq(tasks.boardId, task.boardId),
					gt(tasks.index, TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES - 1)
				)
			)
	]);

	return 'Success';
});
