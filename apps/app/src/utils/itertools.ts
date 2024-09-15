const itertools = {
	chain: function* <T>(...iterators: Iterable<T>[]): Iterable<T> {
		for (const iterator of iterators) {
			yield* iterator;
		}
	}
};

export default itertools;
