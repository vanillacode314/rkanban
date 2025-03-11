import { TBoard, TNode, TTask } from 'db/schema';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createComputed, createContext, JSXElement, untrack, useContext } from 'solid-js';
import { createStore } from 'solid-js/store';

type TClipboardItem = {
	data: string;
	meta?: unknown;
	mode: 'copy' | 'move' | 'selection';
	type: `${string}/${string}`;
};
const DEFAULT_APP_CONTEXT = {
	boards: [],
	clipboard: [],
	currentBoard: null,
	currentNode: null,
	currentTask: null,
	id: nanoid(),
	mode: 'normal',
	path: '/'
} satisfies TAppContext;
type TAppContext = {
	boards: Array<{ tasks: TTask[] } & TBoard>;
	clipboard: TClipboardItem[];
	currentBoard: null | TBoard;
	currentNode: null | TNode;
	currentTask: null | TTask;
	id: string;
	mode: 'normal' | 'selection';
	path: string;
};
const AppContext = createContext<
	[
		appContext: TAppContext,
		{
			addToClipboard: (...item: TClipboardItem[]) => void;
			clearClipboard: () => void;
			filterClipboard: (predicate: (item: TClipboardItem) => boolean) => void;
			setBoards: (boards: Array<{ tasks: TTask[] } & TBoard>) => void;
			setCurrentBoard: (board: TBoard) => void;
			setCurrentNode: (node: TNode) => void;
			setCurrentTask: (task: TTask) => void;
			setMode: (mode: TAppContext['mode']) => void;
		}
	]
>();

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
		untrack(() => setAppContext('path', path));
	});

	createComputed(() => {
		const { clipboard } = appContext;
		const hasSelection = clipboard.some((item) => item.mode === 'selection');
		untrack(() => setAppContext('mode', hasSelection ? 'selection' : 'normal'));
	});

	return (
		<AppContext.Provider
			value={[
				appContext,
				{
					addToClipboard(...item) {
						setAppContext(
							create((app) => {
								app.clipboard.push(...item);
							})
						);
					},
					clearClipboard() {
						setAppContext(
							create((app) => {
								app.clipboard.length = 0;
							})
						);
					},
					filterClipboard(predicate) {
						setAppContext(
							create((app) => {
								app.clipboard = app.clipboard.filter(predicate);
							})
						);
					},
					setBoards(boards) {
						setAppContext(
							create((app) => {
								app.boards = boards;
							})
						);
					},
					setCurrentBoard(board) {
						setAppContext(
							create((app) => {
								app.currentBoard = board;
							})
						);
					},
					setCurrentNode(node) {
						setAppContext(
							create((app) => {
								app.currentNode = node;
							})
						);
					},
					setCurrentTask(task) {
						setAppContext(
							create((app) => {
								app.currentTask = task;
							})
						);
					},
					setMode(mode) {
						setAppContext(
							create((app) => {
								app.mode = mode;
							})
						);
					}
				}
			]}
		>
			{props.children}
		</AppContext.Provider>
	);
}

export { AppProvider, useApp };
export type { TClipboardItem };
