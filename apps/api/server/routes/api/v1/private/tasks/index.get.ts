import { tasks } from 'db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
	const user = event.context.auth!.user;

	return await db.select().from(tasks).where(eq(tasks.userId, user.id));
});
