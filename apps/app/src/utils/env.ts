import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const env = createEnv({
	client: { PUBLIC_RSUITE_CLIENT_ID: z.string().nonempty() },
	clientPrefix: 'PUBLIC_',
	runtimeEnv: import.meta.env
});

export default env;
