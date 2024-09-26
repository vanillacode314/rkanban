function safeParseJson(value: unknown) {
	if (typeof value !== 'string') return null;

	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export { safeParseJson };
