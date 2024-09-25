import { useColorMode } from '@kobalte/core/color-mode';
import { A, useAction, useLocation } from '@solidjs/router';
import { RequestEventLocals } from '@solidjs/start/server';
import { createResource, createSignal, Show, Suspense } from 'solid-js';

import { cn } from '~/lib/utils';
import { getUser, refreshAccessToken, resendVerificationEmail, signOut } from '~/utils/auth.server';
import { localforage } from '~/utils/localforage';

import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

export default function Nav(props: { class?: string }) {
	const location = useLocation();
	const [user, { refetch: refetchUser }] = createResource(
		() => location.pathname,
		() => getUser({ shouldThrow: false }),
		{ deferStream: true, initialValue: null }
	);
	const { toggleColorMode } = useColorMode();
	const $signOut = useAction(signOut);

	return (
		<nav class={cn('border-offset-background border-b bg-background py-4', props.class)}>
			<div class="flex items-center gap-4">
				<A href="/">
					<p class="font-bold uppercase tracking-wide">RKanban</p>
				</A>
				<span class="grow" />
				<Suspense>
					<Show when={user()}>
						<form
							onClick={async (event) => {
								event.preventDefault();
								await $signOut();
								await localforage.removeMany(['privateKey', 'publicKey', 'salt']);
							}}
						>
							<Button class="flex items-center gap-2" type="submit" variant="outline">
								<span>Sign Out</span>
								<span class="i-heroicons:arrow-right-end-on-rectangle text-xl" />
							</Button>
						</form>
					</Show>
				</Suspense>
				<Button onClick={() => toggleColorMode()} size="icon" variant="outline">
					<div class="i-heroicons:sun rotate-0 scale-100 text-xl transition-all dark:-rotate-90 dark:scale-0" />
					<div class="i-heroicons:moon absolute rotate-90 scale-0 text-xl transition-all dark:rotate-0 dark:scale-100" />
					<span class="sr-only">Toggle theme</span>
				</Button>
			</div>
			<VerificationEmailAlert refetchUser={refetchUser} user={user()} />
		</nav>
	);
}

function VerificationEmailAlert(props: {
	refetchUser: () => void;
	user: RequestEventLocals['user'];
}) {
	const [cooldown, setCooldown] = createSignal<number>(0);

	function countdown() {
		if (cooldown() > 0) return;
		setCooldown(60);
		const interval = setInterval(() => {
			if (cooldown() <= 0) {
				clearInterval(interval);
			}
			setCooldown((value) => value - 1);
		}, 1000);
	}

	return (
		<Show when={props.user && !props.user.emailVerified}>
			<Alert class="mt-4 flex flex-col justify-between gap-4 md:flex-row">
				<div>
					<AlertTitle>Email not verified</AlertTitle>
					<AlertDescription>
						Please check your inbox to verify your email. Unverified accounts will be deleted 30days
						from creation.
					</AlertDescription>
				</div>
				<div class="flex shrink-0 gap-4">
					<Button onClick={() => refreshAccessToken()} variant="secondary">
						Check Again
					</Button>
					<Button
						disabled={cooldown() > 0}
						onClick={async () => {
							countdown();
							await resendVerificationEmail();
							props.refetchUser();
						}}
						variant="outline"
					>
						Send Again{' '}
						{cooldown() > 0 ?
							<>(Wait {cooldown()}s)</>
						:	''}
					</Button>
				</div>
			</Alert>
		</Show>
	);
}
