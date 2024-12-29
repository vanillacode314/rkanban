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
	mode: 'normal',
	boards: [],
	clipboard: [],
	currentBoard: null,
	currentNode: null,
	currentTask: null,
	id: nanoid(),
	path: '/'
} satisfies TAppContext;
type TAppContext = {
	mode: 'normal' | 'selection';
	boards: Array<{ tasks: TTask[] } & TBoard>;
	clipboard: TClipboardItem[];
	currentBoard: null | TBoard;
	currentNode: null | TNode;
	currentTask: null | TTask;
	id: string;
	path: string;
};
const AppContext = createContext<
	[
		appContext: TAppContext,
		{
			addToClipboard: (...item: TClipboardItem[]) => void;
			filterClipboard: (predicate: (item: TClipboardItem) => boolean) => void;
			clearClipboard: () => void;
			setBoards: (boards: Array<{ tasks: TTask[] } & TBoard>) => void;
			setCurrentNode: (node: TNode) => void;
			setCurrentBoard: (board: TBoard) => void;
			setCurrentTask: (task: TTask) => void;
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
		const selectionLength = clipboard.filter((item) => item.mode === 'selection').length;
		untrack(() => setAppContext('mode', selectionLength > 0 ? 'selection' : 'normal'));
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
					filterClipboard(predicate) {
						setAppContext(
							create((app) => {
								app.clipboard = app.clipboard.filter(predicate);
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
					setCurrentBoard(board) {
						setAppContext(
							create((app) => {
								app.currentBoard = board;
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
					clearClipboard() {
						setAppContext(
							create((app) => {
								app.clipboard.length = 0;
							})
						);
					},
					setBoards(boards) {
						setAppContext(
							create((app) => {
								app.boards = boards;
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
