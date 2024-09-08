import * as M from 'localforage';

const localforage: LocalForage & {
	getMany: <T>(keys: string[]) => Promise<(T | null)[]>;
	setMany: <T>(data: Record<string, T>) => Promise<T[]>;
	removeMany: (keys: string[]) => Promise<void[]>;
} = {
	...M,
	getMany: <T>(keys: string[]) => Promise.all(keys.map((key) => M.getItem<T>(key))),
	setMany: <T>(data: Record<string, T>) =>
		Promise.all(Object.entries(data).map(([key, value]) => M.setItem<T>(key, value))),
	removeMany: (keys: string[]) => Promise.all(keys.map((key) => M.removeItem(key)))
};

export { localforage };
