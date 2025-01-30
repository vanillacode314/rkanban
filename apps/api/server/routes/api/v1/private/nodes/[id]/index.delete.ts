import { nodes } from 'db/schema';
import { and, eq } from 'drizzle-orm';

import { getPathByNodeId } from '~/utils/db/queries/nodes';

const paramsSchema = z.object({
	id: z.string()
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const { id } = await getValidatedRouterParams(event, paramsSchema.parse);

	const path = await getPathByNodeId(id, user.id);
	const [node] = await db
		.delete(nodes)
		.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
		.returning();
	if (!node) throw createError({ statusCode: 404 });

	return { node, path };
});
