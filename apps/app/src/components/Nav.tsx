import { useColorMode } from '@kobalte/core/color-mode';
import { A, action, redirect, useLocation } from '@solidjs/router';
import { RequestEventLocals } from '@solidjs/start/server';
import { eq } from 'drizzle-orm';
import { Show, Suspense, createResource, createSignal } from 'solid-js';
import { getRequestEvent } from 'solid-js/web';
import { deleteCookie, getCookie } from 'vinxi/http';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { db } from '~/db';
import { refreshTokens } from '~/db/schema';
import { cn } from '~/lib/utils';
import { getUser, refreshAccessToken, resendVerificationEmail } from '~/utils/auth.server';
import { Button } from './ui/button';

const signOut = action(async () => {
	'use server';

	const event = getRequestEvent()!;
	deleteCookie(event.nativeEvent, 'accessToken');
	const refreshToken = getCookie(event.nativeEvent, 'refreshToken');
	deleteCookie(event.nativeEvent, 'refreshToken');
	if (refreshToken) await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
	return redirect('/auth/signin');
}, 'signout');

export default function Nav(props: { class?: string }) {
	const location = useLocation();
	const [user, { refetch: refetchUser }] = createResource(
		() => location.pathname,
		() => getUser(null),
		{ initialValue: null, deferStream: true }
	);
	const { toggleColorMode } = useColorMode();

	return (
		<nav class={cn('border-offset-background border-b bg-background py-4', props.class)}>
			<div class="flex items-center gap-4">
				<A href="/">
					<p class="font-bold uppercase tracking-wide">JustKanban</p>
				</A>
				<span class="grow" />
				<Suspense>
					<Show when={user()}>
						<form action={signOut} method="post">
							<Button type="submit" class="flex items-center gap-2" variant="outline">
								<span>Sign Out</span>
								<span class="i-heroicons:arrow-right-end-on-rectangle text-xl"></span>
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
