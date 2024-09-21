import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
	client: {
		PUBLIC_PUBLISH_URL: z.string().url(),
		PUBLIC_SOCKET_URL: z.string().url()
	},
	clientPrefix: 'PUBLIC_',
	runtimeEnv: import.meta.env
});

export default env;
