import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import env from './utils/env/server';
import { ms } from './utils/ms';

const client =
	env.TURSO_SYNC_URL !== undefined ?
		createClient({
			url: env.TURSO_CONNECTION_URL,
			authToken: env.TURSO_AUTH_TOKEN,
			syncUrl: env.TURSO_SYNC_URL,
			syncInterval: ms('5 min') / 1000
		})
	:	createClient({
			url: env.TURSO_CONNECTION_URL,
			authToken: env.TURSO_AUTH_TOKEN
		});

export const db = drizzle(client);
