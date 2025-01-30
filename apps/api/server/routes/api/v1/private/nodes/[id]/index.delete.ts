import { type } from 'arktype';
import { nodes } from 'db/schema';
import { and, eq } from 'drizzle-orm';

import { throwOnParseError } from '~/utils/arktype';
import { getPathByNodeId } from '~/utils/db/queries/nodes';

const paramsSchema = type({
	id: 'string > 1'
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const { id } = await getValidatedRouterParams(event, (v) => throwOnParseError(paramsSchema(v)));

	const path = await getPathByNodeId(id, user.id);
	if (path === '/') throw createError({ message: 'Cannot delete root node', statusCode: 403 });
	const [node] = await db
		.delete(nodes)
		.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
		.returning();
	if (!node) throw createError({ statusCode: 404 });

	return { node, path };
});
