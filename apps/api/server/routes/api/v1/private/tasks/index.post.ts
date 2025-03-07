import { type } from 'arktype';
import { boards, tasks } from 'db/schema';
import { and, eq, sql } from 'drizzle-orm';

const bodySchema = type({
	boardId: 'string.trim',
	'body?': 'string.trim',
	'id?': 'string',
	title: 'string.trim'
});

export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const body = await readValidatedBody(event, throwOnParseError(bodySchema));

	const [board] = await db
		.select()
		.from(boards)
		.where(and(eq(boards.id, body.boardId), eq(boards.userId, user.id)));
	if (!board)
		throw createError({ message: 'Board not found', statusCode: 404, statusMessage: 'Not Found' });

	const index = await db
		.select({ maxIndex: sql<null | number>`max(${tasks.index})` })
		.from(tasks)
		.where(and(eq(tasks.userId, user.id), eq(tasks.boardId, board.id)))
		.then(([{ maxIndex }]) => {
			if (maxIndex === null) return 0;
			return maxIndex + 1;
		});

	const [task] = await db
		.insert(tasks)
		.values({
			boardId: body.boardId,
			body: body.body,
			id: body.id,
			index,
			title: body.title,
			userId: user.id
		})
		.returning();

	return task;
});
