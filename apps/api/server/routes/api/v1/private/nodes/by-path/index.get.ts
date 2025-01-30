import { getNodeByPath } from '~/utils/db/queries/nodes';

const querySchema = z.object({
	includeChildren: z
		.string()
		.default('false')
		.transform((val) => val === 'true'),
	path: z.string()
});
export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;

	const { includeChildren, path } = await getValidatedQuery(event, querySchema.parse);
	const nodes = await getNodeByPath(path, user.id, {
		includeChildren,
		orderBy: 'name'
	});
	if (nodes.length === 0)
		throw createError({
			data: { path },
			message: 'No nodes found.',
			statusCode: 404,
			statusMessage: 'Not Found'
		});
	return nodes;
});
