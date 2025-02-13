import { type } from 'arktype';
import { nodes } from 'db/schema';

import { RESERVED_PATHS } from '~/consts';
import { getNodeByPath, getPathByNodeId } from '~/utils/db/queries/nodes';

const bodySchema = type({
	'appId?': 'string | undefined',
	'id?': 'string | undefined',
	name: 'string.trim',
	parentId: 'string'
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ statusCode: 400, message: body.summary });
	}
	const parentPath = await getPathByNodeId(body.parentId, user.id);
	const fullPath = path.join(parentPath, body.name);
	if (RESERVED_PATHS.includes(fullPath)) {
		throw createError({
			message: `Path ${fullPath} is reserved`,
			statusCode: 409
		});
	}

	const [node] = await getNodeByPath(fullPath, user.id);
	if (node) throw createError({ statusCode: 409 });

	const [$node] = await db
		.insert(nodes)
		.values({
			id: body.id,
			name: body.name,
			parentId: body.parentId,
			userId: user.id
		})
		.returning();

	return { node: $node, path: fullPath };
});
