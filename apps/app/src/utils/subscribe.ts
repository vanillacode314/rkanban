import { createWS } from '@solid-primitives/websocket';
import { messageSchema, type TMessage } from 'schema';
import { isServer } from 'solid-js/web';

import { useApp } from '~/context/app';

import env from './env/client';

function createSubscription(
	handlers: Record<
		string,
		Record<
			({ type: 'publish' } & TMessage)['item']['type'],
			(item: { data?: unknown; id: string }) => void
		>
	>
) {
	return;
	if (isServer) return;
	const ws = createWS(env.PUBLIC_SOCKET_URL);
	const [appContext] = useApp();
	ws.send(JSON.stringify({ id: appContext.id, type: 'subscribe' }));

	ws.addEventListener('message', (event) => {
		const result = messageSchema.options[0].shape.item.safeParse(JSON.parse(event.data));
		if (!result.success) return;
		const { table, type } = result.data;
		if (table in handlers && type in handlers[table]) {
			handlers[table][type]({ data: result.data.data, id: result.data.id });
		}
	});
}

export { createSubscription };
