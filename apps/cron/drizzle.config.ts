import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: 'src/db/schema.ts',
	dialect: 'sqlite',
	migrations: {
		prefix: 'supabase'
	},
	driver: 'turso',
	dbCredentials: {
		url: process.env.TURSO_CONNECTION_URL!,
		authToken: process.env.TURSO_AUTH_TOKEN!
	},
	verbose: true,
	strict: true
});
