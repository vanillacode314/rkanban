import { MetaProvider } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';
import 'virtual:uno.css';
import './app.css';

export default function App() {
	return (
		<Router
			singleFlight={false}
			root={(props) => (
				<Suspense fallback={<div class="bg-red-900">loading...</div>}>
					<MetaProvider>{props.children}</MetaProvider>
				</Suspense>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
