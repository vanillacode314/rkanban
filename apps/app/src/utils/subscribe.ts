import { createWS } from '@solid-primitives/websocket';
import { revalidate } from '@solidjs/router';
import { publishSchema, type TPublish, TSubscribe } from 'schema';
import { isServer } from 'solid-js/web';
import { toast } from 'solid-sonner';

import { useApp } from '~/context/app';

import { decryptWithUserKeys } from './auth.server';
import env from './env/client';

async function createSubscription(handler: (item: TPublish['item']) => void) {
	if (isServer) return;
	const [appContext, _] = useApp();
	const ws = createWS(env.PUBLIC_SOCKET_URL);
	const token = await fetch('/api/v1/me/websocket-token').then((res) => res.text());

	ws.send(JSON.stringify({ appId: appContext.id, token, type: 'subscribe' } satisfies TSubscribe));
	ws.addEventListener('message', async (event) => {
		const result = publishSchema.shape.item.safeParse(JSON.parse(event.data));
		if (!result.success) return;
		handler(result.data);
	});
}

function makeSubscriptionHandler(validKeys: string[]) {
	return (async ({ invalidate, message }) => {
		const keys = invalidate.filter((key) => validKeys.includes(key));
		if (keys.length === 0) return;
		const promises = [] as Promise<void>[];
		for (const key of keys) {
			promises.push(revalidate(key));
		}
		await Promise.all(promises);
		const re = new RegExp(String.raw`encrypted:[^\s]+`);
		const matches = message.match(re);
		let decryptedString: string;
		if (!matches) {
			decryptedString = message;
		} else {
			const decryptedValues = await Promise.all(
				matches.map(async (match) => {
					const data = match.slice('encrypted:'.length);
					return [match, await decryptWithUserKeys(data)];
				})
			);
			decryptedString = message;
			for (const [match, decrypted] of decryptedValues) {
				decryptedString = decryptedString.replace(match, decrypted);
			}
		}
		toast.info(decryptedString);
	}) satisfies Parameters<typeof createSubscription>[0];
}

export { createSubscription, makeSubscriptionHandler };
