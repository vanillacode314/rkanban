import { nodes, TNode } from 'db/schema';
import { sql } from 'drizzle-orm';

import { RESERVED_PATHS } from '~/consts';
import { getNodeByPath } from '~/utils/db/queries/nodes';

const bodySchema = z.object({
	appId: z.string().optional(),
	id: z.string().optional(),
	name: z.string().trim(),
	parentPath: z.string().trim()
});
export default defineEventHandler(async (event) => {
	const user = event.context.user;
	const { id, name, parentPath } = await readValidatedBody(event, bodySchema.parse);

	const fullPath = path.join(parentPath, name);
	if (RESERVED_PATHS.includes(fullPath)) {
		throw createError({
			message: `Path ${fullPath} is reserved`,
			statusCode: 409,
			statusMessage: 'Conflict'
		});
	}

	const { node } = await getNodeByPath(fullPath, user.id);
	if (node) throw createError({ statusCode: 409 });

	const [parentNode] = (await db.all(
		sql.raw(GET_NODES_BY_PATH_QUERY(parentPath, user.id))
	)) as TNode[];
	const [$node] = await db
		.insert(nodes)
		.values({
			id,
			name: name,
			parentId: parentNode.id,
			userId: user.id
		})
		.returning();

	return $node;
});
