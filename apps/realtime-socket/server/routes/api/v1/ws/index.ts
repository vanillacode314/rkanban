import { messageSchema } from 'schema';

const subscribers = new Map<string, (event: MessageEvent) => void>();
const dbUpdatesChannel = new BroadcastChannel('db-updates');

export default defineWebSocketHandler({
	open(peer) {
		console.log('[ws] open', peer);
	},

	message(peer, message) {
		const result = messageSchema.safeParse(safeParseJson(message.text()));
		if (!result.success) {
			peer.send({ success: false, error: result.error.errors });
			return;
		}
		const { type } = result.data;
		switch (type) {
			case 'publish':
				console.log('GOT PUBLISH', result.data.item);
				dbUpdatesChannel.postMessage(result.data.item);
				peer.send({
					success: true,
					message: 'Successfully published'
				});
				break;
			case 'subscribe':
				console.log('GOT SUBSCRIBE');
				const callback = (event: MessageEvent) => peer.send(event.data);
				subscribers.set(peer.id, callback);
				dbUpdatesChannel.addEventListener('message', callback);
				peer.send({
					success: true,
					message: 'Successfully subscribed'
				});
				break;
		}
	},

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
	}
});

function safeParseJson(value: unknown) {
	if (typeof value !== 'string') return null;

	try {
		return JSON.parse(value);
	} catch (e) {
		return null;
	}
}
