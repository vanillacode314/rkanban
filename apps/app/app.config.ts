import { defineConfig } from '@solidjs/start/config';
import devtools from 'solid-devtools/vite';
import { presetIcons, presetWebFonts } from 'unocss';
import Unocss from 'unocss/vite';

//import { analyzer } from 'vite-bundle-analyzer';
import clientEnv from './src/utils/env/client';
import serverEnv from './src/utils/env/server';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
clientEnv;
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
serverEnv;

export default defineConfig({
	server: {
		prerender: {
			routes: ['/offline', '/manifest.webmanifest']
		}
	},
	vite: {
		envPrefix: 'PUBLIC_',
		plugins: [
			devtools({
				/* features options - all disabled by default */
				autoname: true // e.g. enable autoname
			}),
			Unocss({
				presets: [
					presetIcons({
						extraProperties: {
							color: 'auto',
							display: 'inline-block',
							'vertical-align': 'middle'
						}
					}),
					presetWebFonts({
						fonts: {
							sans: 'Inter:400,500,600,700,800,900'
						}
					})
				]
			})
			//analyzer({ analyzerPort: 8889 })
		]
	}
});
