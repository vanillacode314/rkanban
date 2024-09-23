import { ReactiveMap } from '@solid-primitives/map';
import { createContext, createSignal, JSXElement, untrack, useContext } from 'solid-js';

type TDirtyContext = ReactiveMap<string, { children: TDirtyContext; isDirty: boolean }>;

const DirtyContext =
	createContext<
		[
			isDirty: (path: string | string[]) => boolean,
			setIsDirty: (path: string | string[], value: boolean) => void
		]
	>();

function useDirty() {
	const value = useContext(DirtyContext);
	if (!value) throw new Error('useDirty must be used within an DirtyProvider');
	return value;
}

function DirtyProvider(props: { children: JSXElement }) {
	const rootMap = new ReactiveMap() satisfies TDirtyContext;

	function setIsDirty(path: string | string[], value: boolean, map = rootMap): void {
		untrack(() => {
			const $path = Array.isArray(path) ? path : [path];
			for (const [index, part] of $path.entries()) {
				let current = map.get(part);
				if (!current) {
					const [newMap, setNewMap] = createSignal(new ReactiveMap() satisfies TDirtyContext);
					const [isDirty, setIsDirty] = createSignal<boolean>(false);
					current = {
						get children() {
							return newMap();
						},
						set children(value) {
							setNewMap(value);
						},
						get isDirty() {
							return isDirty();
						},
						set isDirty(value) {
							setIsDirty(value);
						}
					};
					map.set(part, current);
				}

				if (index === $path.length - 1) {
					if (value === false && current.children.size === 0) {
						map.delete(part);
						return;
					}
					current.isDirty = value;
					break;
				}
				setIsDirty($path.slice(1), value, current.children);
			}
		});
	}

	function isDirty(path: string | string[]): boolean {
		const $path = Array.isArray(path) ? path : [path];
		let map = rootMap;
		for (const part of $path) {
			const current = map.get(part);
			if (!current) return false;
			if (current.isDirty) return true;
			map = current.children;
		}
		return false;
	}

	return (
		<DirtyContext.Provider value={[isDirty, setIsDirty]}>{props.children}</DirtyContext.Provider>
	);
}

export { DirtyProvider, useDirty };
