import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import env from '~/utils/env';
import { ms } from '~/utils/ms';

const IS_BUILDING = process.env.TURSO_BUILDING !== undefined;

let client;
if (env.TURSO_SYNC_URL) {
	client =
		!IS_BUILDING ?
			createClient({
				authToken: env.TURSO_AUTH_TOKEN,
				syncInterval: ms('5 min') / 1000,
				syncUrl: env.TURSO_SYNC_URL,
				url: env.TURSO_CONNECTION_URL
			})
		:	createClient({
				authToken: env.TURSO_AUTH_TOKEN,
				url: env.TURSO_SYNC_URL
			});
} else {
	client = createClient({
		authToken: env.TURSO_AUTH_TOKEN,
		url: env.TURSO_CONNECTION_URL
	});
}

export const db = drizzle(client);
