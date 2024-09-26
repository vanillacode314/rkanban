import { createWS } from '@solid-primitives/websocket';
import { publishSchema, type TPublish, TSubscribe } from 'schema';
import { isServer } from 'solid-js/web';

import { useApp } from '~/context/app';

import env from './env/client';

async function createSubscription(handler: (item: TPublish['item']) => void) {
	if (isServer) return;
	const [appContext, _setAppContext] = useApp();
	const ws = createWS(env.PUBLIC_SOCKET_URL);
	const token = await fetch('/api/v1/me/websocket-token').then((res) => res.text());

	ws.send(JSON.stringify({ appId: appContext.id, token, type: 'subscribe' } satisfies TSubscribe));
	ws.addEventListener('message', async (event) => {
		const result = publishSchema.shape.item.safeParse(JSON.parse(event.data));
		if (!result.success) return;
		handler(result.data);
	});
}

export { createSubscription };
