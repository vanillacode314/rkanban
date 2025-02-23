import { FetchError } from './fetchers';

function handleFetchError(
	errorMap: { fallback: string } & Record<number, string>,
	error: unknown
): string;
function handleFetchError(
	errorMap: { fallback: string } & Record<number, string>
): (error: unknown) => string;
function handleFetchError(
	errorMap: { fallback: string } & Record<number, string>,
	error?: unknown
): ((error: unknown) => string) | string {
	const parse = (error: unknown) => {
		if (error instanceof FetchError && error.status in errorMap) return errorMap[error.status];

		return errorMap.fallback;
	};
	if (error !== undefined) return parse(error);
	return parse;
}

export { handleFetchError };
