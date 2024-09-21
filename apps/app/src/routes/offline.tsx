import {
	ColorModeProvider,
	ColorModeScript,
	cookieStorageManagerSSR,
	useColorMode
} from '@kobalte/core/color-mode';
import { createConnectivitySignal } from '@solid-primitives/connectivity';
import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createEffect } from 'solid-js';
import { isServer } from 'solid-js/web';
import { getCookie } from 'vinxi/http';

import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

function OfflinePage() {
	const navigate = useNavigate();
	const isOnline = createConnectivitySignal();
	const { toggleColorMode } = useColorMode();
	createEffect(() => isOnline() && navigate('/'));

	return (
		<>
			<Title>Offline | RKanban</Title>
			<nav
				class={cn('border-offset-background full-width content-grid border-b bg-background py-4')}
			>
				<div class="flex items-center gap-4">
					<p class="font-bold uppercase tracking-wide">RKanban</p>
					<span class="grow" />
					<Button onClick={() => toggleColorMode()} size="icon" variant="outline">
						<div class="i-heroicons:sun rotate-0 scale-100 text-xl transition-all dark:-rotate-90 dark:scale-0" />
						<div class="i-heroicons:moon absolute rotate-90 scale-0 text-xl transition-all dark:rotate-0 dark:scale-100" />
						<span class="sr-only">Toggle theme</span>
					</Button>
				</div>
			</nav>
			<div class="grid h-full place-content-center place-items-center">
				<span class="i-heroicons:exclamation-circle text-8xl" />
				<p>You are offline</p>
			</div>
		</>
	);
}

export default function Layout() {
	const storageManager = cookieStorageManagerSSR(isServer ? getServerCookies() : document.cookie);
	return (
		<>
			<ColorModeScript storageType={storageManager.type} />
			<ColorModeProvider storageManager={storageManager}>
				<OfflinePage />
			</ColorModeProvider>
		</>
	);
}

function getServerCookies() {
	'use server';
	const colorMode = getCookie('kb-color-mode');
	return colorMode ? `kb-color-mode=${colorMode}` : '';
}
