function compressPath(path: string) {
	if (path === '/') return '/';
	const parts = path.split('/').filter(Boolean);
	const last = parts.pop();
	return parts.map((p) => p.substring(0, 3)).join('/') + '/' + last;
}

function join(...parts: string[]) {
	const retval: string[] = [];
	if (parts[0].startsWith('/')) retval.push('');
	for (const part of parts) {
		const subparts = part.split('/').filter(Boolean);
		for (const subpart of subparts) {
			if (subpart === '.') {
				continue;
			} else if (subpart === '..') {
				retval.pop();
			} else retval.push(subpart);
		}
	}
	return retval.join('/') || '/';
}

function splitIntoParts(path: string): Array<{ name: string; path: string }> {
	const _parts = path.split('/').filter(Boolean);
	let currentPath: string = '/';
	const parts: Array<{ name: string; path: string }> = [];
	for (const part of _parts) {
		parts.push({ name: part, path: currentPath + part });
		currentPath += part + '/';
	}
	return parts;
}
export const path = { compressPath, join, splitIntoParts };

export { compressPath, join, splitIntoParts };
