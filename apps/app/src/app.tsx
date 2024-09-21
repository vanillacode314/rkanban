import { MetaProvider } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Component, createSignal, ErrorBoundary, onMount, Show, Suspense } from 'solid-js';
import 'virtual:uno.css';

import './app.css';
import { Button } from './components/ui/button';
import { cn } from './lib/utils';
import { listenForWaitingServiceWorker } from './utils/service-worker';

const queryClient = new QueryClient();

const ErrorPage: Component = () => {
	const [updateAvailable, setUpdateAvailable] = createSignal<boolean>(false);

	onMount(async () => {
		const registration = await navigator.serviceWorker.getRegistration();
		if (!registration) return;
		await listenForWaitingServiceWorker(registration);
		setUpdateAvailable(true);
	});

	async function doUpdate() {
		const registration = await navigator.serviceWorker.getRegistration();
		if (!registration) return;
		registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
	}

	return (
		<>
			<nav
				class={cn('border-offset-background full-width content-grid border-b bg-background py-4')}
			>
				<div class="flex items-center gap-4">
					<p class="font-bold uppercase tracking-wide">RKanban</p>
					<span class="grow" />
				</div>
			</nav>
			<div class="grid h-full place-content-center place-items-center gap-4">
				<span class="i-heroicons:exclamation-circle text-8xl" />
				<p>An Error Occured</p>
				<Show
					fallback={
						<Button onClick={() => window.location.reload()} size="lg">
							Refresh
						</Button>
					}
					when={updateAvailable()}
				>
					<Button onClick={doUpdate} size="lg">
						Update App
					</Button>
				</Show>
			</div>
		</>
	);
};

export default function App() {
	return (
		<Router
			root={(props) => (
				<ErrorBoundary fallback={<ErrorPage />}>
					<Suspense
						fallback={
							<div class="grid h-full place-content-center gap-2">
								<span class="i-svg-spinners:180-ring-with-bg text-7xl" />
								<span>Loading...</span>
							</div>
						}
					>
						<QueryClientProvider client={queryClient}>
							<MetaProvider>{props.children}</MetaProvider>
						</QueryClientProvider>
					</Suspense>
				</ErrorBoundary>
			)}
			singleFlight={false}
		>
			<FileRoutes />
		</Router>
	);
}
