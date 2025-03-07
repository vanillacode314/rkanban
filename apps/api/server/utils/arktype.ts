import { type, Type } from 'arktype';
type TThrowOnParseErrorReturn<T> =
	T extends Type ? (input: unknown) => Exclude<T['infer'], type.errors> : Exclude<T, type.errors>;
function throwOnParseError<T extends Type>(
	input: T
): (input: unknown) => Exclude<T['infer'], type.errors>;
function throwOnParseError<T extends Exclude<unknown, Type>>(input: T): Exclude<T, type.errors>;
function throwOnParseError<T>(input: T): TThrowOnParseErrorReturn<T> {
	if (input instanceof Type) {
		return ((v: unknown) => throwOnParseError(input(v))) as TThrowOnParseErrorReturn<T>;
	}
	if (input instanceof type.errors) {
		console.error('[ArkType Parse Error]:', input.summary);
		throw input;
	} else {
		return input as TThrowOnParseErrorReturn<T>;
	}
}

export { throwOnParseError };
