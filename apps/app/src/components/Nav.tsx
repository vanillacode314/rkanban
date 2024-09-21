import { useColorMode } from '@kobalte/core/color-mode';
import { A, useAction, useLocation } from '@solidjs/router';
import { RequestEventLocals } from '@solidjs/start/server';
import { Show, Suspense, createResource, createSignal } from 'solid-js';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { cn } from '~/lib/utils';
import { getUser, refreshAccessToken, resendVerificationEmail, signOut } from '~/utils/auth.server';
import { localforage } from '~/utils/localforage';
import { Button } from './ui/button';

export default function Nav(props: { class?: string }) {
	const location = useLocation();
	const [user, { refetch: refetchUser }] = createResource(
		() => location.pathname,
		() => getUser({ shouldThrow: false }),
		{ initialValue: null, deferStream: true }
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
							<Button type="submit" class="flex items-center gap-2" variant="outline">
								<span>Sign Out</span>
								<span class="i-heroicons:arrow-right-end-on-rectangle text-xl" />
							</Button>
						</form>
					</Show>
				</Suspense>
				<Button onClick={() => toggleColorMode()} variant="outline" size="icon">
					<div class="i-heroicons:sun rotate-0 scale-100 text-xl transition-all dark:-rotate-90 dark:scale-0" />
					<div class="i-heroicons:moon absolute rotate-90 scale-0 text-xl transition-all dark:rotate-0 dark:scale-100" />
					<span class="sr-only">Toggle theme</span>
				</Button>
			</div>
			<VerificationEmailAlert user={user()} refetchUser={refetchUser} />
		</nav>
	);
}

function VerificationEmailAlert(props: {
	user: RequestEventLocals['user'];
	refetchUser: () => void;
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
			<Alert class="mt-4 flex justify-between gap-4">
				<div>
					<AlertTitle>Email not verified</AlertTitle>
					<AlertDescription>
						Please check your inbox to verify your email. Unverified accounts will be deleted 30days
						from creation.
					</AlertDescription>
				</div>
				<div class="flex gap-4">
					<Button variant="secondary" onClick={() => refreshAccessToken()}>
						Check Again
					</Button>
					<Button
						variant="outline"
						onClick={async () => {
							countdown();
							await resendVerificationEmail();
							props.refetchUser();
						}}
						disabled={cooldown() > 0}
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
