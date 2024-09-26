import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
	bundle: true,
	clean: true,
	entryPoints: ['src/**/*.ts'],
	format: 'esm',
	minify: !options.watch,
	onSuccess: 'tsc --emitDeclarationOnly --declaration',
	outbase: 'src',
	outdir: 'dist',
	platform: 'neutral',
	sourcemap: true
}));
