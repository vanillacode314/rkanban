//https://nitro.unjs.io/config
export default defineNitroConfig({
	srcDir: 'server',
	compatibilityDate: '2025-01-06',
	imports: {
		imports: [{ name: 'z', from: 'zod' }],
		dirs: [
			'./server/utils/**/*',
			{
				glob: './server/utils/**/*',
				types: false
			}
		]
	}
});
