import { generateSW } from 'workbox-build';

const BASE = process.env.NETLIFY ? 'dist' : '.output/public';
generateSW({
	clientsClaim: true,
	globDirectory: BASE,
	globIgnores: ['_server/**'],
	globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
	inlineWorkboxRuntime: true,
	navigationPreload: true,
	runtimeCaching: [
		{
			handler: 'NetworkOnly',
			options: {
				precacheFallback: {
					fallbackURL: '/offline/index.html'
				}
			},
			urlPattern: ({ request }) => request.mode === 'navigate'
		}
	],
	sourcemap: false,
	// additionalManifestEntries: ['manifest.webmanifest'],
	swDest: BASE + '/sw.js'
}).then(({ count, size, warnings }) => {
	if (warnings.length > 0) {
		console.warn('Warnings encountered while generating a service worker:', warnings.join('\n'));
	}
	console.log(
		`Generated a service worker, which will precache ${count} files, totaling ${size} bytes.`
	);
});
