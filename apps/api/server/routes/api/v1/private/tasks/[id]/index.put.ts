import { type } from 'arktype';
import { tasks } from 'db/schema';
import { and, eq } from 'drizzle-orm';

const bodySchema = type({
	'body?': 'string.trim',
	'tags?': 'string[]',
	'title?': 'string.trim'
});
const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const body = await readValidatedBody(event, throwOnParseError(bodySchema));
	const params = await getValidatedRouterParams(event, throwOnParseError(paramsSchema));

	const [task] = await db
		.update(tasks)
		.set({ body: body.body, tags: body.tags, title: body.title })
		.where(and(eq(tasks.id, params.id), eq(tasks.userId, user.id)))
		.returning();

	if (!task) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

	return task;
});
