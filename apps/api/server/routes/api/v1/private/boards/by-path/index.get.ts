import { getBoardsByPath } from '~/utils/db/queries/boards';

const querySchema = z.object({
	includeTasks: z
		.string()
		.default('false')
		.transform((val) => val === 'true'),
	path: z.string()
});
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const { includeTasks, path } = await getValidatedQuery(event, querySchema.parse);
	return getBoardsByPath(path, user.id, { includeTasks });
});
