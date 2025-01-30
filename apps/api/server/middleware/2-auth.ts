import { TUser } from 'db/schema';

declare module 'h3' {
	interface H3EventContext {
		auth: null | { user: TUser };
	}
}

const PRIVATE_ROUTE_REGEX = new RegExp(String.raw`/api/v\d+/private/.*`);
export default defineEventHandler(async (event) => {
	const auth = await useAuth(event);
	event.context.auth = auth;
	const url = getRequestURL(event);
	if (PRIVATE_ROUTE_REGEX.test(url.pathname) && !event.context.auth) {
		throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
	}
});
