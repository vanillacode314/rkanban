import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
	clientPrefix: 'PUBLIC_',
	client: {
		PUBLIC_SOCKET_ADDRESS: z.string().url()
	},
	runtimeEnv: import.meta.env
});

export default env;
