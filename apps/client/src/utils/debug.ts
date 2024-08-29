function dt<T>(arg: T, meta: unknown = ''): T {
	if (meta) {
		return console.trace(arg, meta), arg;
	} else {
		return console.trace(arg), arg;
	}
}
function d<T>(arg: T, meta: unknown = ''): T {
	if (meta) {
		return console.log(arg, meta), arg;
	} else {
		return console.log(arg), arg;
	}
}

export { d, dt };
