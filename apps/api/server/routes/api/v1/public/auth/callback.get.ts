import { users } from 'db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { authSchema } from 'schema';

import { ACCESS_TOKEN_EXPIRES_IN_SECONDS, TOKEN_JWT_OPTIONS } from '~/consts';

const querySchema = z.object({
	code: z.string()
});
export default defineEventHandler(async (event) => {
	const { code } = await getValidatedQuery(event, querySchema.parse);
	let { accessToken, refreshToken } = await $fetch<{ accessToken: string; refreshToken: string }>(
		env.RSUITE_API_URL + '/api/v1/public/oauth2/token',
		{
			body: {
				client_id: env.PUBLIC_RSUITE_CLIENT_ID,
				client_secret: env.RSUITE_CLIENT_SECRET,
				code,
				redirect_uri: 'https://kanban.raqueeb.com/auth/callback'
			},
			method: 'POST'
		}
	);
	const auth = await $fetch<{ user: { email: string } }>(env.RSUITE_API_URL + '/api/v1/public/me', {
		headers: {
			Cookie: 'accessToken=' + accessToken
		}
	});

	const [record] = await db.select().from(users).where(eq(users.email, auth.user.email));

	let user;
	if (!record) {
		[user] = await db
			.insert(users)
			.values({ email: auth.user.email, passwordHash: '' })
			.returning();
	} else {
		user = record;
	}
	accessToken = jwt.sign(authSchema.parse({ type: 'access', user }), env.AUTH_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS
	});
	setCookie(event, 'rKanbanAuthSource', 'rsuite', TOKEN_JWT_OPTIONS);
	setCookie(event, 'rKanbanAccessToken', accessToken, TOKEN_JWT_OPTIONS);
	setCookie(event, 'rKanbanRefreshToken', refreshToken, TOKEN_JWT_OPTIONS);
	return sendRedirect(event, '/');
});
