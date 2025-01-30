import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
	runtimeEnv: process.env,
	server: {
		PUBLIC_RSUITE_CLIENT_ID: z.string().nonempty(),
		RSUITE_CLIENT_SECRET: z.string().nonempty(),
		AUTH_SECRET: z.string().length(128),
		NOTIFICATIONS_EMAIL_ADDRESS: z.string().nonempty(),
		RESEND_API_KEY: z.string().nonempty(),
		RSUITE_API_URL: z.string().url(),
		TURSO_AUTH_TOKEN: z.string().nonempty(),
		TURSO_CONNECTION_URL: z.string().url(),
		TURSO_SYNC_URL: z.string().url().optional()
	}
});

export default env;
