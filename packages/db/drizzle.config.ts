import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dbCredentials: {
		authToken: process.env.TURSO_AUTH_TOKEN!,
		url: process.env.TURSO_CONNECTION_URL!
	},
	dialect: 'turso',
	migrations: {
		prefix: 'supabase'
	},
	schema: '../../packages/db/src/lib/schema.ts',
	strict: true,
	verbose: true
});
