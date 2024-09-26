import { TBoard, TNode, TTask } from 'db/schema';
import { nanoid } from 'nanoid';
import { createComputed, createContext, JSXElement, untrack, useContext } from 'solid-js';
import { createStore, SetStoreFunction } from 'solid-js/store';

type TClipboardItem = {
	data: string;
	meta?: unknown;
	mode: 'copy' | 'move';
	type: `${string}/${string}`;
};
const DEFAULT_APP_CONTEXT = {
	boards: [],
	clipboard: [],
	currentBoard: null,
	currentNode: null,
	currentTask: null,
	id: nanoid(),
	path: '/'
} satisfies TAppContext;
type TAppContext = {
	boards: Array<{ tasks: TTask[] } & TBoard>;
	clipboard: TClipboardItem[];
	currentBoard: null | TBoard;
	currentNode: null | TNode;
	currentTask: null | TTask;
	id: string;
	path: string;
};
const AppContext =
	createContext<[appContext: TAppContext, setAppContext: SetStoreFunction<TAppContext>]>();

function useApp() {
	const value = useContext(AppContext);
	if (!value) throw new Error('useApp must be used within an AppProvider');
	return value;
}

function AppProvider(props: { children: JSXElement; path: string }) {
	const [appContext, setAppContext] = createStore<TAppContext>({
		...structuredClone(DEFAULT_APP_CONTEXT),
		path: props.path
	});

	createComputed(() => {
		const { path } = props;
		untrack(() => {
			setAppContext('path', path);
		});
	});

	return (
		<AppContext.Provider value={[appContext, setAppContext]}>{props.children}</AppContext.Provider>
	);
}

export { AppProvider, useApp };
