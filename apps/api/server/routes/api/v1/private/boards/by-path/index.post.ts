import { boards } from 'db/schema';
import { and, eq, sql } from 'drizzle-orm';

const bodySchema = z.object({
	appId: z.string().optional(),
	id: z.string().optional(),
	nodePath: z.string(),
	title: z.string().trim()
});

export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const { id, nodePath, title } = await readValidatedBody(event, bodySchema.parse);

	const [node] = await getNodeByPath(nodePath, user.id);
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
			id,
			index,
			nodeId: node.id,
			title,
			userId: user.id
		})
		.returning();

	return board;
});
