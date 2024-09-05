import { trackDeep } from '@solid-primitives/deep';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { createWS } from '@solid-primitives/websocket';
import { A, RouteDefinition, createAsync, useSubmissions } from '@solidjs/router';
import { messageSchema } from 'schema';
import { Show, createComputed, untrack } from 'solid-js';
import Board from '~/components/Board';
import PathCrumbs from '~/components/PathCrumbs';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import { Button } from '~/components/ui/button';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { createBoard, getBoards } from '~/db/utils/boards';
import { decryptObjectKeys } from '~/utils/auth.server';
import env from '~/utils/env/client';

export const route: RouteDefinition = {
	preload: ({ location }) => {
		getBoards(location.pathname);
	},
	matchFilters: {
		project: (pathname: string) =>
			pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	}
};

export default function Home() {
	const [appContext, _setAppContext] = useApp();
	const $serverBoards = createAsync(() => getBoards(appContext.path));
	const [serverBoards, overrideServerBoards] = createWritableMemo(() => $serverBoards());
	const ws = createWS(env.PUBLIC_SOCKET_ADDRESS);
	ws.send(JSON.stringify({ type: 'subscribe' }));
	ws.addEventListener('message', (event) => {
		const result = messageSchema.options[0].shape.item.safeParse(JSON.parse(event.data));
		if (!result.success) return;
		const { table } = result.data;

		switch (table) {
			case 'tasks': {
				switch (result.data.type) {
					case 'create':
						{
							const task = result.data.data! as TTask;
							overrideServerBoards((boards) => {
								if (!boards) return boards;
								const board = boards.find((board) => board.id === task.boardId);
								if (!board) return boards;
								board.tasks.push(task);
								return [...boards];
							});
						}
						break;
					case 'update':
						{
							const task = result.data.data! as TTask;
							overrideServerBoards((boards) => {
								if (!boards) return boards;
								const board = boards.find((board) => board.id === task.boardId);
								if (!board) return boards;
								const taskIndex = board.tasks.findIndex((t) => t.id === task.id);
								if (taskIndex === -1) return boards;
								board.tasks[taskIndex] = task;
								return [...boards];
							});
						}
						break;
					case 'delete': {
						overrideServerBoards((boards) => {
							if (!boards) return boards;
							const board = boards.find((board) =>
								board.tasks.some((t) => t.id === result.data.id)
							);
							if (!board) return boards;
							board.tasks = board.tasks.filter((t) => t.id !== result.data.id);
							return [...boards];
						});
						break;
					}
				}
				break;
			}
			case 'boards': {
				switch (result.data.type) {
					case 'create':
						{
							const board = { ...result.data.data!, tasks: [] as TTask[] } as TBoard & {
								tasks: TTask[];
							};
							overrideServerBoards((boards) => {
								if (!boards) return boards;
								return [...boards, board];
							});
						}
						break;
					case 'update':
						{
							const board = result.data.data! as TBoard;
							overrideServerBoards((boards) => {
								if (!boards) return boards;
								const boardIndex = boards.findIndex(({ id }) => id === board.id);
								if (boardIndex === -1) return boards;
								boards[boardIndex] = { ...boards[boardIndex], ...board };
								return [...boards];
							});
						}
						break;
					case 'delete': {
						overrideServerBoards((boards) => {
							if (!boards) return boards;
							return boards.filter((board) => board.id !== result.data.id);
						});
						break;
					}
				}
				break;
			}
		}
	});

	return (
		<Show
			when={serverBoards() instanceof Error}
			fallback={<Project serverBoards={serverBoards() as Array<TBoard & { tasks: TTask[] }>} />}
		>
			<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
				<div>Project Not Found</div>
				<Button as={A} href="/">
					Go Home
				</Button>
			</div>
		</Show>
	);
}
function Project(props: { serverBoards?: Array<TBoard & { tasks: TTask[] }> }) {
	const [_appContext, setAppContext] = useApp();
	const submissions = useSubmissions(createBoard);

	const pendingBoards = () =>
		[...submissions.values()]
			.filter((submission) => submission.pending)
			.map((submission) => ({
				id: String(submission.input[0].get('id')),
				title: String(submission.input[0].get('title')),
				tasks: [] as TTask[],
				createdAt: new Date(),
				updatedAt: new Date(),
				userId: 'pending',
				index: props.serverBoards!.length,
				nodeId: 'pending'
			}));

	const boards = createAsync(
		async () => {
			trackDeep(() => props.serverBoards);
			const boards: Array<TBoard & { tasks: TTask[] }> =
				props.serverBoards ? [...props.serverBoards, ...pendingBoards()] : [];
			return await decryptObjectKeys(structuredClone(boards), ['title']);
		},
		{ initialValue: [] }
	);

	createComputed(() => {
		const $boards = boards();
		untrack(() => {
			setAppContext('boards', $boards);
		});
	});

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<Show when={boards().length > 0}>
				<div class="flex justify-end gap-4">
					<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Board</span>
					</Button>
				</div>
			</Show>
			<PathCrumbs />
			<Show
				when={boards().length > 0}
				fallback={
					<div class="relative isolate grid h-full place-content-center place-items-center gap-4 font-medium">
						<img
							src="/empty.svg"
							class="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-5"
						/>
						<span>Empty Project</span>
						<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
							<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
								<span class="i-heroicons:plus text-lg"></span>
								<span>Create Board</span>
							</Button>
						</div>
					</div>
				}
			>
				<div class="flex h-full snap-x snap-mandatory gap-[var(--gap)] overflow-auto [--cols:1] [--gap:theme(spacing.4)] sm:[--cols:2] md:[--cols:3]">
					<Key each={boards()} by="id">
						{(board, index) => (
							<Board
								class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
								board={board()}
								index={index()}
							/>
						)}
					</Key>
				</div>
			</Show>
		</div>
	);
}
