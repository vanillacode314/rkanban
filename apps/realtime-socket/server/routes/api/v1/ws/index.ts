import { messageSchema } from 'schema';

import { z } from 'zod';

const dbUpdatesChannel = 'db-updates';
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
				peer.publish(dbUpdatesChannel, result.data.item);
				peer.send({
					success: true,
					message: 'Successfully published'
				});
				break;
			case 'subscribe':
				console.log('GOT SUBSCRIBE');
				peer.subscribe(dbUpdatesChannel);
				peer.send({
					success: true,
					message: 'Successfully subscribed'
				});
				break;
		}
	},

	close(peer, event) {
		peer.unsubscribe('db-updates');
		console.log('[ws] close', peer, event);
	},

	error(peer, error) {
		// peer.unsubscribe("db-updates");
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
