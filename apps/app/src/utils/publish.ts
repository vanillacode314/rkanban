import type { TMessage } from 'schema';

import env from './env/client';

function createNotifier(table: string) {
	return async <T extends ({ type: 'publish' } & TMessage)['item']>(
		item: Omit<T, 'table'>,
		id?: string
	) => {
		return;
		const body = JSON.stringify({
			id,
			item: { ...item, table },
			type: 'publish'
		});
		await fetch(env.PUBLIC_PUBLISH_URL, {
			body,
			headers: { 'Content-Type': 'application/json' },
			method: 'POST'
		});
	};
}

export { createNotifier };
