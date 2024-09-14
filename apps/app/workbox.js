import { generateSW } from 'workbox-build';

const BASE = process.env.NETLIFY ? 'dist' : '.output/public';
generateSW({
	globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
	// additionalManifestEntries: ['manifest.webmanifest'],
	swDest: BASE + '/sw.js',
	globDirectory: BASE,
	globIgnores: ['_server/**'],
	sourcemap: false,
	inlineWorkboxRuntime: true,
	navigationPreload: true,
	runtimeCaching: [
		{
			urlPattern: ({ request }) => request.mode === 'navigate',
			handler: 'NetworkOnly',
			options: {
				precacheFallback: {
					fallbackURL: '/offline/index.html'
				}
			}
		}
	]
}).then(({ count, size, warnings }) => {
	if (warnings.length > 0) {
		console.warn('Warnings encountered while generating a service worker:', warnings.join('\n'));
	}
	console.log(
		`Generated a service worker, which will precache ${count} files, totaling ${size} bytes.`
	);
});
