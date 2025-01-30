import { type } from 'arktype';
import { tasks } from 'db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';

const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ message: params.summary, statusCode: 400 });
	}

	const task = await db.transaction(async (tx) => {
		const [deletedTask] = await tx
			.delete(tasks)
			.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)))
			.returning();

		if (!deletedTask) return deletedTask;
		await tx
			.update(tasks)
			.set({ index: sql`${tasks.index} - 1` })
			.where(
				and(
					eq(tasks.userId, user.id),
					gt(tasks.index, deletedTask.index),
					eq(tasks.boardId, deletedTask.boardId)
				)
			);
		return deletedTask;
	});

	if (!task) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

	return task;
});
