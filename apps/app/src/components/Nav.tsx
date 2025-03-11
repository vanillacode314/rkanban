import { useColorMode } from '@kobalte/core/color-mode';
import { A } from '@solidjs/router';
import { Show, Suspense } from 'solid-js';
import { toast } from 'solid-sonner';

import { cn } from '~/lib/utils';
import { useUser } from '~/queries/user';

import { Button } from './ui/button';

export default function Nav(props: { class?: string }) {
	const { toggleColorMode } = useColorMode();

	return (
		<nav class={cn('border-offset-background border-b bg-background py-4', props.class)}>
			<div class="flex items-center gap-4">
				<A href="/">
					<p class="font-bold uppercase tracking-wide">RKanban</p>
				</A>
				<span class="grow" />
				<Suspense>
					<UserCard />
				</Suspense>
				<Button onClick={() => toggleColorMode()} size="icon" variant="outline">
					<div class="i-heroicons:sun rotate-0 scale-100 text-xl transition-all dark:-rotate-90 dark:scale-0" />
					<div class="i-heroicons:moon absolute rotate-90 scale-0 text-xl transition-all dark:rotate-0 dark:scale-100" />
					<span class="sr-only">Toggle theme</span>
				</Button>
			</div>
		</nav>
	);
}

function UserCard() {
	const [user, { signOut }] = useUser();
	return (
		<Show when={user.isSuccess && user.data}>
			<form
				action="/api/v1/public/auth/signout"
				method="post"
				onSubmit={(e) => {
					e.preventDefault();
					toast.promise(() => signOut.mutateAsync(), {
						error: 'Failed to sign out',
						loading: 'Signing out...',
						success: 'Signed out successfully'
					});
				}}
			>
				<Button class="flex items-center gap-2" type="submit" variant="outline">
					<span>Sign Out</span>
					<span class="i-heroicons:arrow-right-end-on-rectangle text-xl" />
				</Button>
			</form>
		</Show>
	);
}
