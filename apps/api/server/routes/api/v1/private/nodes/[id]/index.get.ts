import { nodes } from 'db/schema';
import { and, eq } from 'drizzle-orm';

const querySchema = z.object({
	includeChildren: z
		.string()
		.default('false')
		.transform((val) => val === 'true')
});
const paramsSchema = z.object({
	id: z.string()
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const { id } = await getValidatedRouterParams(event, paramsSchema.parse);

	const { includeChildren } = await getValidatedQuery(event, querySchema.parse);
	let query = db
		.select()
		.from(nodes)
		.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
		.$dynamic();

	if (includeChildren) {
		query = query.unionAll(
			db
				.select()
				.from(nodes)
				.where(and(eq(nodes.parentId, id), eq(nodes.userId, user.id)))
		);
	}

	const $nodes = await query;
	if ($nodes.length === 0)
		throw createError({
			message: JSON.stringify({ path }),
			statusCode: 404,
			statusMessage: 'Not Found'
		});
	return { children: $nodes, node: $nodes.shift() };
});
