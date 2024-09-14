import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import env from './utils/env/server';
import { ms } from './utils/ms';

const IS_BUILDING = process.env.TURSO_BUILDING !== undefined;

let client;
if (env.TURSO_SYNC_URL !== undefined) {
	client =
		!IS_BUILDING ?
			createClient({
				url: env.TURSO_CONNECTION_URL,
				authToken: env.TURSO_AUTH_TOKEN,
				syncUrl: env.TURSO_SYNC_URL,
				syncInterval: ms('5 min') / 1000
			})
		:	createClient({
				url: env.TURSO_SYNC_URL,
				authToken: env.TURSO_AUTH_TOKEN
			});
} else {
	client = createClient({
		url: env.TURSO_CONNECTION_URL,
		authToken: env.TURSO_AUTH_TOKEN
	});
}

export const db = drizzle(client);
