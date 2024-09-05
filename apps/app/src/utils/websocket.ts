import type { TMessage } from 'schema';
import env from './env/client';

function sendMessage(url: string, data: string) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		ws.onerror = () => reject();
		ws.onopen = () => {
			ws.onmessage = (event) => {
				resolve(event.data);
			};
			ws.send(data);
		};
	});
}

function createNotifier(table: string) {
	return <T extends (TMessage & { type: 'publish' })['item']>(item: Omit<T, 'table'>) => {
		return sendMessage(
			env.PUBLIC_SOCKET_ADDRESS,
			JSON.stringify({
				type: 'publish',
				item: { ...item, table }
			})
		);
	};
}

export { createNotifier, sendMessage };
