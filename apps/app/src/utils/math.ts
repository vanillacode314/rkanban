function round(num: number, places: number): number {
	const multiplier = 10 ** places;
	return Math.round(num * multiplier) / multiplier;
}

export { round };
