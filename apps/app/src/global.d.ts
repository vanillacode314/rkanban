/// <reference types="@solidjs/start/env" />

import type { TUser } from './db/schema';

declare module '@solidjs/start/server' {
	interface RequestEventLocals {
		user: Omit<TUser, 'passwordHash'> | null;
	}
}

export {};
