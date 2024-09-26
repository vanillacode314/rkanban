import type { TPublishInput } from 'schema';

import env from './env/client';

function createNotifier(invalidate: string | string[]) {
	return async ({ appId, message, token }: { appId: string; message: string; token: string }) => {
		const body = JSON.stringify({
			appId,
			item: { invalidate, message },
			token,
			type: 'publish'
		} satisfies TPublishInput);
		await fetch(env.PUBLIC_PUBLISH_URL, {
			body,
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		});
	};
}

export { createNotifier };
