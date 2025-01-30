import { type } from 'arktype';
import { nodes } from 'db/schema';
import { and, eq } from 'drizzle-orm';

import { RESERVED_PATHS } from '~/consts';
import { getPathByNodeId } from '~/utils/db/queries/nodes';

const paramsSchema = type({ id: 'string' });
const bodySchema = type({
	'appId?': 'string | undefined',
	'name?': 'string.trim | undefined',
	'parentId?': 'string | undefined'
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;

	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ statusCode: 400, message: params.summary });
	}
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ statusCode: 400, message: body.summary });
	}

	const currentPath = await getPathByNodeId(params.id, user.id);
	const newPath = body.name ? path.join(currentPath, '..', body.name) : currentPath;
	if (body.name) {
		if (RESERVED_PATHS.includes(newPath))
			throw createError({ statusCode: 409, message: `Path ${newPath} is reserved` });

		if (newPath !== currentPath) {
			const [existingNode] = await getNodeByPath(newPath, user.id);
			if (existingNode) throw createError({ statusCode: 409 });
		}
	}

	const [node] = await db
		.update(nodes)
		.set(body)
		.where(and(eq(nodes.id, params.id), eq(nodes.userId, user.id)))
		.returning();

	if (!node) throw createError({ statusCode: 404 });
	return { node, path: newPath };
});
