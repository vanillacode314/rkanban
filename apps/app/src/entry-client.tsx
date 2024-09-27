// @refresh reload
import { mount, StartClient } from '@solidjs/start/client';
import 'solid-devtools';
import { toast } from 'solid-sonner';

import { listenForWaitingServiceWorker } from './utils/service-worker';

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
	window.addEventListener('load', async () => {
		try {
			const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
			console.log('SW registered: ', registration);
			await listenForWaitingServiceWorker(registration).then(
				() => {
					promptUserToRefresh(registration);

					let refreshing: boolean;
					navigator.serviceWorker.addEventListener('controllerchange', function () {
						if (refreshing) return;
						refreshing = true;
						window.location.reload();
					});
				},
				() => console.log('Service Worker first install')
			);
		} catch (error) {
			console.log('SW registration failed: ', error);
		}
	});
}

mount(() => <StartClient />, document.getElementById('app')!);
