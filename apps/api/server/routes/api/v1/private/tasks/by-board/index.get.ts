import { type } from 'arktype';
import { tasks } from 'db/schema';
import { and, eq } from 'drizzle-orm';

const querySchema = type({ boardId: 'string' });
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;

	const query = await getValidatedQuery(event, querySchema);
	if (query instanceof type.errors) {
		throw createError({ message: query.summary, statusCode: 400 });
	}

	return await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.userId, user.id), eq(tasks.boardId, query.boardId)));
});
