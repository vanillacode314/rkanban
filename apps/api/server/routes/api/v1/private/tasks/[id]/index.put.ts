import { tasks } from 'db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const bodySchema = z.object({
	tags: z.string().array().optional(),
	title: z.string().trim()
});
const paramsSchema = z.object({ id: z.string() });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const { tags, title } = await readValidatedBody(event, bodySchema.parse);
	const { id } = await getValidatedRouterParams(event, paramsSchema.parse);

	const [task] = await db
		.update(tasks)
		.set({ tags, title })
		.where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
		.returning();

	if (!task) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

	return task;
});
