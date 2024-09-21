import * as M from 'localforage';

type TupleWithNull<TTuple extends unknown[]> =
	TTuple extends [infer First, ...infer Rest] ? [First | null, ...TupleWithNull<Rest>] : [];

const localforage: LocalForage & {
	getMany: <T extends unknown[]>(keys: string[]) => Promise<TupleWithNull<T>>;
	setMany: <T extends unknown[]>(data: Record<string, T[number]>) => Promise<TupleWithNull<T>>;
	removeMany: (keys: string[]) => Promise<void[]>;
} = {
	...M,
	getMany: <T extends unknown[]>(keys: string[]) =>
		Promise.all(keys.map((key) => M.getItem<T>(key))) as Promise<TupleWithNull<T>>,
	setMany: <T extends unknown[]>(data: Record<string, T[number]>) =>
		Promise.all(
			Object.entries(data).map(([key, value]) => M.setItem<T[number]>(key, value))
		) as Promise<TupleWithNull<T>>,
	removeMany: (keys: string[]) => Promise.all(keys.map((key) => M.removeItem(key)))
};

export { localforage };
