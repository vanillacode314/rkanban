import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
	runtimeEnv: process.env,
	server: {
		AUTH_SECRET: z.string().min(1)
	}
});

export default env;
