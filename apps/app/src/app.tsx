import { MetaProvider } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { Suspense } from 'solid-js';
import 'virtual:uno.css';
import './app.css';

const queryClient = new QueryClient();

export default function App() {
	return (
		<Router
			singleFlight={false}
			root={(props) => (
				<Suspense
					fallback={
						<div class="grid h-full place-content-center gap-2">
							<span class="i-svg-spinners:180-ring-with-bg text-7xl"></span>
							<span>Loading...</span>
						</div>
					}
				>
					<QueryClientProvider client={queryClient}>
						<MetaProvider>{props.children}</MetaProvider>
					</QueryClientProvider>
				</Suspense>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
