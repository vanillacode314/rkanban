import { type } from 'arktype';
import { onMount } from 'solid-js';

const paramsSchema = type({
	code: 'string',
	state: 'string'
});
export default function CallbackPage() {
	onMount(() => {
		const url = new URL(window.location.href);
		const result = paramsSchema(Object.fromEntries(url.searchParams));
		if (result instanceof type.errors) {
			window.location.pathname = '/';
			return;
		}
		window.location.pathname = '/api/v1/public/auth/callback';
	});
	return <p>Logging you in</p>;
}
