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

export { uniqBy };
