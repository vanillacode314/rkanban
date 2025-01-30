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
				client_id:
					'zbG_lxQMM9yGiOGPrDroxl0-2rWTSAvR7lZsDCd319_LrUCTyC0398MN-J1XVF5JZz5rgLprdg9As3kfo0OFeDh1a48fEYVSyaQfvlKd8RJR8IDMzbXIrWPUFuOM8HEk',
				client_secret:
					'jMYka_6acm14KsV658W5UabMvOZiUryrWcKRPb1Gie1r8vJLap8iuXcAClYIBfIF0gSCgWC5PhtPzWooSRaIXnQ6QWzkuAiLg3zgbcPgnMW-gibPFqDojuBwE_Tt_pjx',
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
	setCookie(event, 'authSource', 'rsuite', TOKEN_JWT_OPTIONS);
	setCookie(event, 'accessToken', accessToken, TOKEN_JWT_OPTIONS);
	setCookie(event, 'refreshToken', refreshToken, TOKEN_JWT_OPTIONS);
	return sendRedirect(event, '/');
});
