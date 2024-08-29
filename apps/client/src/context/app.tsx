import * as R from 'remeda';
import {
	createComputed,
	createContext,
	createEffect,
	JSXElement,
	untrack,
	useContext
} from 'solid-js';
import { createStore, SetStoreFunction } from 'solid-js/store';
import { TBoard, TNode, TTask } from '~/db/schema';

const DEFAULT_APP_CONTEXT = {
	currentBoard: null,
	currentTask: null,
	currentNode: null,
	path: '/'
} satisfies TAppContext;
type TAppContext = {
	currentBoard: null | TBoard;
	currentTask: null | TTask;
	path: string;
	currentNode: TNode | null;
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
