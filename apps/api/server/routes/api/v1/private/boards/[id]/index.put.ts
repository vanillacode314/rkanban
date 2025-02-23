import { type } from 'arktype';
import { boards } from 'db/schema';
import { and, eq } from 'drizzle-orm';

const bodySchema = type({ title: 'string.trim' });
const paramsSchema = type({ id: 'string > 1' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);
	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ message: body.summary, statusCode: 400 });
	}
	const params = await getValidatedRouterParams(event, paramsSchema);
	if (params instanceof type.errors) {
		throw createError({ message: params.summary, statusCode: 400 });
	}

	const [board] = await db
		.update(boards)
		.set({ title: body.title })
		.where(and(eq(boards.id, params.id), eq(boards.userId, user.id)))
		.returning();

	if (!board) throw createError({ statusCode: 404, statusMessage: 'Not Found' });
	const path = await getPathByNodeId(board.nodeId, user.id);

	return { board, path };
});
