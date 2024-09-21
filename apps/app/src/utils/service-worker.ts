function listenForWaitingServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
	return new Promise<void>((resolve) => {
		function awaitStateChange() {
			registration.installing?.addEventListener('statechange', function () {
				if (this.state === 'installed') resolve();
			});
		}
		if (registration.waiting) return resolve();
		if (registration.installing) awaitStateChange();
		registration.addEventListener('updatefound', awaitStateChange);
	});
}

export { listenForWaitingServiceWorker };
