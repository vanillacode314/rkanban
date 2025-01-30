import { type } from 'arktype';
import { boards, nodes } from 'db/schema';
import { and, eq, sql } from 'drizzle-orm';

const bodySchema = type({
	'appId?': 'string | undefined',
	'id?': 'string | undefined',
	nodeId: 'string',
	title: 'string.trim'
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ statusCode: 400, message: body.summary });
	}

	const [node] = await db
		.select()
		.from(nodes)
		.where(and(eq(nodes.id, body.nodeId), eq(nodes.userId, user.id)));
	if (!node) throw createError({ statusCode: 404 });

	const index = await db
		.select({ maxIndex: sql<null | number>`max(${boards.index})` })
		.from(boards)
		.where(and(eq(boards.userId, user.id), eq(boards.nodeId, node.id)))
		.then(([{ maxIndex }]) => {
			if (maxIndex === null) return 0;
			return maxIndex + 1;
		});

	const [board] = await db
		.insert(boards)
		.values({
			id: body.id,
			index,
			nodeId: body.nodeId,
			title: body.title,
			userId: user.id
		})
		.returning();

	return board;
});
