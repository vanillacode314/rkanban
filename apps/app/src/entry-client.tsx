// @refresh reload
import { mount, StartClient } from '@solidjs/start/client';
import 'solid-devtools';
import { toast } from 'solid-sonner';

import { listenForWaitingServiceWorker } from './utils/service-worker';

let refreshing: boolean;
navigator.serviceWorker.addEventListener('controllerchange', function () {
	if (refreshing) return;
	refreshing = true;
	window.location.reload();
});

function promptUserToRefresh(registration: ServiceWorkerRegistration) {
	toast('New version available!', {
		action: {
			label: 'Update',
			onClick: () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
		},
		duration: Number.POSITIVE_INFINITY
	});
}

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js', { scope: '/' })
			.then(async (registration) => {
				console.log('SW registered: ', registration);
				if (!registration.active) {
					await listenForWaitingServiceWorker(registration);
					registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
					return;
				}
				await listenForWaitingServiceWorker(registration);
				promptUserToRefresh(registration);
			})
			.catch((registrationError) => {
				console.log('SW registration failed: ', registrationError);
			});
	});
}

mount(() => <StartClient />, document.getElementById('app')!);
