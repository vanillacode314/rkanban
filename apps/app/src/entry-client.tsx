// @refresh reload
import { mount, StartClient } from '@solidjs/start/client';

function listenForWaitingServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		function awaitStateChange() {
			registration.installing?.addEventListener('statechange', function () {
				if (this.state === 'installed') resolve();
			});
		}
		if (!registration) return;
		if (registration.waiting) return resolve();
		if (registration.installing) awaitStateChange();
		registration.addEventListener('updatefound', awaitStateChange);
	});
}

let refreshing: boolean;
navigator.serviceWorker.addEventListener('controllerchange', function () {
	if (refreshing) return;
	refreshing = true;
	window.location.reload();
});

function promptUserToRefresh(registration: ServiceWorkerRegistration) {
	// this is just an example
	// don't use window.confirm in real life; it's terrible
	if (confirm('New version available! OK to refresh?')) {
		registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
	}
}

if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js', { scope: '/' })
			.then(async (registration) => {
				console.log('SW registered: ', registration);
				await listenForWaitingServiceWorker(registration);
				promptUserToRefresh(registration);
			})
			.catch((registrationError) => {
				console.log('SW registration failed: ', registrationError);
			});
	});
}

mount(() => <StartClient />, document.getElementById('app')!);
