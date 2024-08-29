import { defineConfig } from '@solidjs/start/config';
import { presetIcons, presetWebFonts } from 'unocss';
import Unocss from 'unocss/vite';

export default defineConfig({
	server: {
		prerender: {
			routes: ['/offline', '/manifest.webmanifest']
		}
	},
	vite: {
		plugins: [
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
			})
		]
	}
});
