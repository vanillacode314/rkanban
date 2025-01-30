import { useLocation } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { TAuth } from 'schema';

import { apiFetch } from './fetchers';

function useUser(pathname?: string) {
	const location = useLocation();
	return createQuery(() => ({
		deferStream: true,
		queryFn: (): Promise<null | TAuth['user']> =>
			apiFetch
				.forwardHeaders()
				.as_json<null | TAuth>('/api/v1/public/me')
				.then((res) => res?.user ?? null),
		queryKey: ['user', pathname ?? location.pathname]
	}));
}

export { useUser };
