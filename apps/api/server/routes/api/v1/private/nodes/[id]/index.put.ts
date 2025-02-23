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
	const user = await isAuthenticated(event);

	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ message: params.summary, statusCode: 400 });
	}
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ message: body.summary, statusCode: 400 });
	}

	const [existingNode] = await db
		.select()
		.from(nodes)
		.where(and(eq(nodes.id, params.id), eq(nodes.userId, user.id)));
	if (!existingNode) throw createError({ statusCode: 404 });

	const isMoved = Boolean(body.parentId && body.parentId !== existingNode.parentId);
	const isRenamed = Boolean(body.name && body.name !== existingNode.name);
	const currentPath = await getPathByNodeId(params.id, user.id);
	const parentPath =
		isMoved ? await getPathByNodeId(body.parentId!, user.id) : path.join(currentPath, '..');
	const newPath: string = path.join(parentPath, isRenamed ? body.name! : existingNode.name);
	if (RESERVED_PATHS.includes(newPath))
		throw createError({ message: `Path ${newPath} is reserved`, statusCode: 403 });

	if (newPath !== currentPath) {
		const [existingNode] = await getNodeByPath(newPath, user.id);
		if (existingNode) throw createError({ statusCode: 409 });
	}

	const [node] = await db
		.update(nodes)
		.set(body)
		.where(and(eq(nodes.id, params.id), eq(nodes.userId, user.id)))
		.returning();

	return { node, original: { node: existingNode, path: currentPath }, path: newPath };
});
