import { createMiddleware } from '@solidjs/start/middleware';
import { TAuth } from 'schema';

import { apiFetch } from './utils/fetchers';

export default createMiddleware({
	onRequest: [
		async (event) => {
			const url = new URL(event.request.url);
			const auth = await apiFetch.as_json<TAuth>(url.origin + '/api/v1/public/me', {
				headers: event.request.headers
			});
			const isAuthRoute = url.pathname.startsWith('/auth');
			const isServerRoute = url.pathname.startsWith('/_server');
			const loggedIn = auth !== null;
			if (!isServerRoute) {
				if (isAuthRoute && loggedIn) {
					return new Response(null, { headers: { location: '/' }, status: 302 });
				}
				if (!isAuthRoute && !loggedIn) {
					const redirectUrl = url.search ? url.pathname + url.search : url.pathname;
					return new Response(null, {
						headers: { location: `/auth/signin?redirect=${encodeURIComponent(redirectUrl)}` },
						status: 302
					});
				}
			}
		}
	]
});
