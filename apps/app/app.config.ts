import { defineConfig } from '@solidjs/start/config';
import devtools from 'solid-devtools/vite';
import { presetIcons, presetWebFonts } from 'unocss';
import Unocss from 'unocss/vite';
import { analyzer } from 'vite-bundle-analyzer';
import clientEnv from './src/utils/env/client';
import serverEnv from './src/utils/env/server';

clientEnv;
serverEnv;

export default defineConfig({
	ssr: true,
	server: {
		prerender: {
			routes: ['/offline', '/manifest.webmanifest']
		}
	},
	devOverlay: true,
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
							display: 'inline-block',
							color: 'auto',
							'vertical-align': 'middle'
						}
					}),
					presetWebFonts({
						fonts: {
							sans: 'Inter:400,500,600,700,800,900'
						}
					})
				]
			}),
			analyzer({ analyzerPort: 8889 })
		]
	}
});
