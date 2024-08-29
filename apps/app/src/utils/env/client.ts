import { createEnv } from '@t3-oss/env-core';

export const env = createEnv({
	clientPrefix: 'PUBLIC_',
	client: {},
	runtimeEnv: import.meta.env
});

export default env;
