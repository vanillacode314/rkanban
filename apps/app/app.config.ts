import { defineConfig } from '@solidjs/start/config';
import { presetIcons, presetWebFonts } from 'unocss';
import Unocss from 'unocss/vite';
import { compression } from 'vite-plugin-compression2';

import env from './src/utils/env';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
env;

export default defineConfig({
	devOverlay: true,
	// middleware: 'src/middleware.ts',
	server: {
		compatibilityDate: '2025-01-02',
		prerender: {
			routes: ['/offline', '/manifest.webmanifest']
		},
		devProxy: {
			'/api': 'http://localhost:3002/api'
		},
		static: true
	},
	ssr: false,
	vite: {
		optimizeDeps: {
			exclude: ['sqlocal']
		},
		envPrefix: 'PUBLIC_',
		plugins: [
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
			}),
			compression()
			//analyzer({ analyzerPort: 8889 })
		]
	}
});
