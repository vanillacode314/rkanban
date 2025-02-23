import { tasks } from 'db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

const bodySchema = z.object({
	id: z.string()
});

export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const { id } = await readValidatedBody(event, bodySchema.parse);

	const task = await db.transaction(async (tx) => {
		const [deletedTask] = await tx
			.delete(tasks)
			.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
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
