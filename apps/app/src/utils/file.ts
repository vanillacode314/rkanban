function download(data: string | Record<string, unknown>, filename: string) {
	if (typeof data != 'string') {
		data = JSON.stringify(data, null, 2);
	}
	const a = document.createElement('a');
	a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function getFileText(accept: string = 'application/json'): Promise<string | null> {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = accept;
	input.click();
	return new Promise<string | null>((resolve) => {
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result as string);
			};
			reader.readAsText(new Blob([file], { type: file?.type ?? 'text/plain' }));
		};
	});
}

export { download, getFileText };
