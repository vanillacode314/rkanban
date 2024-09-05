import type { TMessage } from 'schema';
import env from './env/client';

function createNotifier(table: string) {
	return async <T extends (TMessage & { type: 'publish' })['item']>(item: Omit<T, 'table'>) => {
		const body = JSON.stringify({
			type: 'publish',
			item: { ...item, table }
		});
		await fetch(env.PUBLIC_PUBLISH_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body
		});
	};
}

export { createNotifier };
