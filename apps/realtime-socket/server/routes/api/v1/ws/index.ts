import { type Peer } from 'crossws';
import jwt from 'jsonwebtoken';
import { messageSchema, publishSchema, TPublish, TSubscribe } from 'schema';

import env from '~/utils/env/server';
import { safeParseJson } from '~/utils/json';

const dbUpdatesChannel = new BroadcastChannel('db-updates');

type PeerId = string;
const subscribers = new Map<PeerId, (event: MessageEvent) => void>();

function addSubscriber(peerId: string, callback: (event: MessageEvent) => void): void {
	subscribers.set(peerId, callback);
	dbUpdatesChannel.addEventListener('message', callback);
}

function removeSubscriber(peerId: string): void {
	const callback = subscribers.get(peerId);
	if (!callback) return;
	dbUpdatesChannel.removeEventListener('message', callback);
	subscribers.delete(peerId);
}

const handlers = {
	publish: function onPublish(peer: Peer, message: TPublish) {
		dbUpdatesChannel.postMessage(message);
		peer.send(
			JSON.stringify({
				message: 'Successfully published',
				success: true
			})
		);
	},
	subscribe: function onSubscribe(peer: Peer, message: TSubscribe) {
		const { appId, token } = message;
		let user: { id: string };
		try {
			user = jwt.verify(token, env.AUTH_SECRET) as { id: string };
		} catch {
			peer.send(JSON.stringify({ error: ['Invalid token'], success: false }));
			return;
		}

		const callback = (event: MessageEvent) => {
			let messageUser: { id: string };
			try {
				messageUser = jwt.verify(event.data.token, env.AUTH_SECRET) as { id: string };
			} catch {
				peer.send(JSON.stringify({ error: ['Invalid token'], success: false }));
				return;
			}
			if (messageUser === undefined) return;
			if (user === undefined) return;
			if (messageUser.id !== user.id) return;
			const result = publishSchema.safeParse(event.data);

			if (!result.success) {
				peer.send(JSON.stringify({ error: result.error.errors, success: false }));
				return;
			}
			if (result.data.appId === undefined) return;
			if (result.data.appId === appId) return;
			peer.send(JSON.stringify(result.data.item));
		};

		addSubscriber(peer.id, callback);
		peer.send(
			JSON.stringify({
				message: 'Successfully subscribed',
				success: true
			})
		);
	}
};

export default defineWebSocketHandler({
	close(peer) {
		removeSubscriber(peer.id);
		console.log('[ws] close');
	},

	error(peer, error) {
		removeSubscriber(peer.id);
		console.error('[ws] error', error);
	},

	message(peer, message) {
		const result = messageSchema.safeParse(safeParseJson(message.text()));
		if (!result.success) {
			peer.send(JSON.stringify({ error: result.error.errors, success: false }));
			return;
		}
		if (!(result.data.type in handlers)) {
			peer.send(JSON.stringify({ error: ['Invalid message type'], success: false }));
		}
		// @ts-expect-error: typescript doesn't understand that we know that result.data will have the correct type
		handlers[result.data.type](peer, result.data);
	},

	open() {
		console.log('[ws] open');
	}
});
