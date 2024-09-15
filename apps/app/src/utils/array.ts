function uniqBy<T>(array: T[], getKey: (item: T) => string | number) {
	const seen = new Set();
	return array.filter((item) => {
		const key = getKey(item);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

function filterInPlace<T>(array: T[], predicate: (item: T) => boolean): void {
	for (let i = array.length - 1; i >= 0; i--) {
		if (!predicate(array[i])) {
			array.splice(i, 1);
		}
	}
}

export { filterInPlace, uniqBy };
