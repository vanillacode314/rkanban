import { type } from 'arktype';

function throwOnParseError<T>(input: T): Exclude<T, type.errors> {
	if (input instanceof type.errors) {
		console.error('[ArkType Parse Error]:', input.summary);
		throw input;
	} else {
		return input as Exclude<T, type.errors>;
	}
}

export { throwOnParseError };
