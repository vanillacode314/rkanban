import { type } from 'arktype';
import { tasks } from 'db/schema';
import { and, eq, gt, or, sql } from 'drizzle-orm';

const TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES = 99999;

const bodySchema = type({ boardId: 'string > 1', index: 'number' });
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

	const [task] = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)));
	if (!task) throw createError({ statusCode: 404 });
	if (task.boardId === body.boardId)
		return event.$fetch(`/api/v1/private/tasks/${params.id}/shift`, {
			body: { direction: body.index - task.index },
			method: 'POST'
		});

	const currentIndex = task.index;

	await db.batch([
		db
			.update(tasks)
			.set({
				index: sql`${tasks.index} - 1 + ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(tasks.userId, user.id),
					eq(tasks.boardId, task.boardId),
					gt(tasks.index, currentIndex)
				)
			),
		db
			.update(tasks)
			.set({
				index: sql`${tasks.index} + 1 + ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(tasks.userId, user.id),
					eq(tasks.boardId, body.boardId),
					gt(tasks.index, body.index - 1)
				)
			),
		db
			.update(tasks)
			.set({
				boardId: body.boardId,
				index: body.index + TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES
			})
			.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id))),
		db
			.update(tasks)
			.set({
				index: sql`${tasks.index} - ${TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES}`
			})
			.where(
				and(
					eq(tasks.userId, user.id),
					or(eq(tasks.boardId, task.boardId), eq(tasks.boardId, body.boardId)),
					gt(tasks.index, TEMPORARY_LARGE_NUMBER_FOR_SHIFTING_SQL_INDICES - 1)
				)
			)
	]);

	return 'Success';
});
