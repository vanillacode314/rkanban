function assertNotError<T>(value: T): Exclude<T, Error> {
	if (value instanceof Error) throw value;
	return value as Exclude<T, Error>;
}

export { assertNotError };
