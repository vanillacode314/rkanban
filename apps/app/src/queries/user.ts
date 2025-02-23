import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';

import { apiFetch } from '~/utils/fetchers';

import { queries } from '.';

function useUser() {
	const queryClient = useQueryClient();

	const user = createQuery(() => queries.users.me);

	const signOut = createMutation(() => ({
		mutationFn: () => apiFetch('/api/v1/public/auth/signout', { method: 'POST' }),
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: queries.users.me.queryKey });
		}
	}));

	return [user, { signOut }] as const;
}

export { useUser };
