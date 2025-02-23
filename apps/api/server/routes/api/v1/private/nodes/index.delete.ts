import { type } from 'arktype';
import { nodes } from 'db/schema';
import { and, eq, inArray } from 'drizzle-orm';

const bodySchema = type({ ids: 'string[]' });
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);

	const body = await readValidatedBody(event, bodySchema);
	if (body instanceof type.errors) {
		throw createError({ message: body.summary, statusCode: 400 });
	}
	await db.delete(nodes).where(and(inArray(nodes.id, body.ids), eq(nodes.userId, user.id)));

	return { message: 'Deleted successfully', status: 200, statusMessage: 'Success' };
});
