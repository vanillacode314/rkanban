import { TUser, users } from 'db/schema';
import { eq } from 'drizzle-orm';
import { H3Event } from 'h3';
import jwt from 'jsonwebtoken';
import { authSchema, TAuth } from 'schema';

import { ACCESS_TOKEN_EXPIRES_IN_SECONDS, TOKEN_JWT_OPTIONS } from '~/consts';
import env from '~/utils/env';

async function refreshAccessToken(event: H3Event) {
	const authSource = getCookie(event, 'authSource');
	const refreshToken = getCookie(event, 'refreshToken');
	if (!refreshToken || !authSource) throw new Error('Missing refresh token');
	switch (authSource) {
		case 'rsuite': {
			const auth = await $fetch<null | { user: TUser }>(env.RSUITE_API_URL + '/api/v1/public/me', {
				headers: {
					Cookie: `refreshToken=${refreshToken}`
				}
			});
			if (auth === null) throw new Error('Invalid refresh token');
			const [user] = await db.select().from(users).where(eq(users.email, auth.user.email));
			if (!user) throw new Error('Invalid refresh token');
			const payload = authSchema.parse({ type: 'access', user });
			const accessToken = jwt.sign(payload, env.AUTH_SECRET, {
				expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS
			});
			setCookie(event, 'accessToken', accessToken, TOKEN_JWT_OPTIONS);
			return payload;
		}
		default:
			return null;
	}
}

async function useAuth(event: H3Event): Promise<null | Pick<TAuth, 'user'>> {
	const accessToken = getCookie(event, 'accessToken');

	try {
		if (!accessToken) throw new Error('Missing access token');

		const auth = authSchema.parse(jwt.verify(accessToken, env.AUTH_SECRET));
		if (auth.type !== 'access') throw new Error('Invalid access token');
		return auth;
	} catch (error) {
		event.node.req.log.info({ error }, 'Auth Error');
		try {
			return await refreshAccessToken(event);
		} catch (error) {
			event.node.req.log.info({ error }, 'Auth Refresh Error');
			deleteCookie(event, 'authSource');
			deleteCookie(event, 'refreshToken');
			deleteCookie(event, 'accessToken');
			return null;
		}
	}
}

export { refreshAccessToken, useAuth };
