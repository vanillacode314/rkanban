import { messageSchema } from 'schema';

const subscribers = new Map<string, (event: MessageEvent) => void>();
const dbUpdatesChannel = new BroadcastChannel('db-updates');

export default defineWebSocketHandler({
	close(peer, event) {
		const callback = subscribers.get(peer.id);
		dbUpdatesChannel.removeEventListener('message', callback);
		subscribers.delete(peer.id);
		console.log('[ws] close', peer, event);
	},

	error(peer, error) {
		const callback = subscribers.get(peer.id);
		dbUpdatesChannel.removeEventListener('message', callback);
		subscribers.delete(peer.id);
		console.log('[ws] error', peer, error);
	},

	message(peer, message) {
		return;
		const result = messageSchema.safeParse(safeParseJson(message.text()));
		if (!result.success) {
			peer.send({ error: result.error.errors, success: false });
			return;
		}
		const { id, type } = result.data;
		switch (type) {
			case 'publish':
				console.log('GOT PUBLISH', result.data.id);
				dbUpdatesChannel.postMessage(result.data);
				peer.send({
					message: 'Successfully published',
					success: true
				});
				break;
			case 'subscribe': {
				console.log('GOT SUBSCRIBE', result.data.id);
				const callback = (event: MessageEvent) => {
					if (event.data.id === undefined || event.data.id !== id) {
						peer.send(event.data.item);
					}
				};
				subscribers.set(peer.id, callback);
				dbUpdatesChannel.addEventListener('message', callback);
				peer.send({
					message: 'Successfully subscribed',
					success: true
				});
				break;
			}
		}
	},

	open(peer) {
		console.log('[ws] open', peer);
	}
});

function safeParseJson(value: unknown) {
	if (typeof value !== 'string') return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}
