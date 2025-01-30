import { ms } from '~/utils/ms';

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = ms('10 min') / 1000;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = ms('1 year') / 1000;
const TOKEN_JWT_OPTIONS = Object.freeze({
	httpOnly: true,
	maxAge: 2 ** 31,
	path: '/',
	sameSite: 'lax',
	secure: process.env.NODE_ENV === 'production'
});
const RESERVED_PATHS = ['/settings', '/auth/callback'] satisfies string[];

export {
	ACCESS_TOKEN_EXPIRES_IN_SECONDS,
	REFRESH_TOKEN_EXPIRES_IN_SECONDS,
	RESERVED_PATHS,
	TOKEN_JWT_OPTIONS
};
