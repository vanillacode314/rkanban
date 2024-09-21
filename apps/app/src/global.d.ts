/// <reference types="@solidjs/start/env" />

import type { TUser } from './db/schema';

declare module '@solidjs/start/server' {
	interface RequestEventLocals {
		user: null | Omit<TUser, 'passwordHash'>;
	}
}

declare global {
	type MaybePromise<T> = Promise<T> | T;
}

export {};
