import { createWS } from '@solid-primitives/websocket';
import { messageSchema, type TMessage } from 'schema';
import env from './env/client';

function createSubscription(
	handlers: Record<
		string,
		Record<
			(TMessage & { type: 'publish' })['item']['type'],
			(item: { id: string; data?: unknown }) => void
		>
	>
) {
	const ws = createWS(env.PUBLIC_SOCKET_URL);
	ws.send(JSON.stringify({ type: 'subscribe' }));

	ws.addEventListener('message', (event) => {
		const result = messageSchema.options[0].shape.item.safeParse(JSON.parse(event.data));
		if (!result.success) return;
		const { table, type } = result.data;
		if (table in handlers && type in handlers[table]) {
			handlers[table][type]({ id: result.data.id, data: result.data.data });
		}
	});
}

export { createSubscription };
