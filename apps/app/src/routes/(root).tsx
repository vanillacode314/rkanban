import { ColorModeProvider, cookieStorageManagerSSR } from '@kobalte/core/color-mode';
import { createConnectivitySignal } from '@solid-primitives/connectivity';
import { Title } from '@solidjs/meta';
import { useBeforeLeave, useLocation, useNavigate } from '@solidjs/router';
import { TNode } from 'db/schema';
import { createEffect, For, JSXElement, Match, Show, Switch } from 'solid-js';
import { isServer } from 'solid-js/web';
import { toast } from 'solid-sonner';
import { getCookie } from 'vinxi/http';

import Nav from '~/components/Nav';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/ui/card';
import { Toaster } from '~/components/ui/sonner';
import { AppProvider, useApp } from '~/context/app';
import { DBProvider } from '~/context/db';
import { cn } from '~/lib/utils';
import * as path from '~/utils/path';

function RouteGuards() {
	const [_, { filterClipboard }] = useApp();
	useBeforeLeave(() => toast.dismiss());
	useBeforeLeave(() => {
		filterClipboard((item) => item.mode !== 'selection');
	});
	return <></>;
}

const RootLayout = (props: { children: JSXElement }) => {
	const location = useLocation();
	const path = () => decodeURIComponent(location.pathname);
	const storageManager = cookieStorageManagerSSR(isServer ? getServerCookies() : document.cookie);
	const navigate = useNavigate();
	const isOnline = createConnectivitySignal();
	createEffect(() => !isOnline() && navigate('/offline'));

	return (
		<>
			<ColorModeProvider storageManager={storageManager}>
				<AppProvider path={path()}>
					<DBProvider>
						<RouteGuards />
						<Title>RKanban</Title>
						<Toaster closeButton duration={3000} position="top-center" />
						<div class="flex h-full flex-col overflow-hidden">
							<Nav class="full-width content-grid" />
							<div class="content-grid h-full overflow-hidden">{props.children}</div>
						</div>
						<AutoImportModals />
						<Clipboard />
					</DBProvider>
				</AppProvider>
			</ColorModeProvider>
		</>
	);
};

function AutoImportModals() {
	const modals = import.meta.glob('~/components/modals/auto-import/*.tsx', {
		eager: true,
		import: 'default'
	}) as Record<string, () => JSXElement>;

	return <For each={Object.values(modals)}>{(Modal) => <Modal />}</For>;
}

function getServerCookies() {
	'use server';
	const colorMode = getCookie('kb-color-mode');
	return colorMode ? `kb-color-mode=${colorMode}` : '';
}

function Clipboard() {
	const [appContext, { clearClipboard }] = useApp();
	const items = () =>
		appContext.clipboard.filter((item) => item.mode === 'move' || item.mode === 'copy');

	return (
		<Show when={items().length > 0}>
			<Card class="fixed bottom-5 right-5 hidden md:block">
				<CardHeader>
					<CardTitle>Clipboard</CardTitle>
				</CardHeader>
				<CardContent class="flex w-full max-w-sm flex-col gap-2">
					<For each={items()}>
						{(item) => (
							<Switch>
								<Match when={item.type === 'id/node'}>
									<Button
										as="div"
										class="grid grid-cols-[auto_1fr_auto] items-center gap-2"
										variant="secondary"
									>
										<span
											class={cn(
												(item.meta as { node: TNode; path: string }).path.endsWith('.project') ?
													'i-heroicons:document'
												:	'i-heroicons:folder'
											)}
										/>
										<span class="truncate">
											{path.compressPath((item.meta as { node: TNode; path: string }).path)}
										</span>
										<span
											class={cn(
												item.mode === 'move' ?
													'i-heroicons:scissors'
												:	'i-heroicons:document-duplicate'
											)}
										/>
									</Button>
								</Match>
							</Switch>
						)}
					</For>
				</CardContent>
				<CardFooter>
					<Button class="w-full" onClick={clearClipboard}>
						Clear
					</Button>
				</CardFooter>
			</Card>
		</Show>
	);
}

export default RootLayout;
