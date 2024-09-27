function listenForWaitingServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		function awaitStateChange() {
			registration.installing?.addEventListener('statechange', function () {
				if (registration.waiting && navigator.serviceWorker.controller) resolve();
				else reject();
			});
		}
		if (registration.waiting) return resolve();
		if (registration.installing) awaitStateChange();
		registration.addEventListener('updatefound', awaitStateChange);
	});
}

export { listenForWaitingServiceWorker };
