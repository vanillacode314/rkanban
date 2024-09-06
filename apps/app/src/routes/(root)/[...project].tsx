import { trackDeep } from '@solid-primitives/deep';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { A, RouteDefinition, createAsync, useSubmissions } from '@solidjs/router';
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
import { createSubscription } from '~/utils/subscribe';

export const route: RouteDefinition = {
	preload: ({ location }) => {
		getBoards(location.pathname);
	},
	matchFilters: {
		project: (pathname: string) =>
			pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	}
};

export default function ProjectPage() {
	const [appContext, _setAppContext] = useApp();

	const $serverBoards = createAsync(() => getBoards(appContext.path));
	const [serverBoards, overrideServerBoards] = createWritableMemo(() => $serverBoards.latest);

	createSubscription({
		tasks: {
			create: ({ data }) => {
				const task = data as TTask;
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.id === task.boardId);
					if (!board) return boards;
					board.tasks.push(task);
					return [...boards];
				});
			},
			update: ({ data }) => {
				const task = data as TTask;
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.id === task.boardId);
					if (!board) return boards;
					const index = board.tasks.findIndex((t) => t.id === task.id);
					if (-1 === index) return boards;
					board.tasks[index] = task;
					return [...boards];
				});
			},
			delete: ({ id }) => {
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.tasks.some((task) => task.id === id));
					if (!board) return boards;
					const taskIndex = board.tasks.findIndex((task) => task.id === id);
					if (-1 === taskIndex) return boards;
					board.tasks.splice(taskIndex, 1);
					return [...boards];
				});
			}
		},
		boards: {
			create: ({ data }) => {
				const board = { ...(data as TBoard), tasks: [] };
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					boards.push(board);
					return [...boards];
				});
			},
			update: ({ data }) => {
				const board = data as TBoard;
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					const index = boards.findIndex((b) => b.id === board.id);
					if (-1 === index) return boards;
					boards[index] = { ...boards[index], ...board };
					return [...boards];
				});
			},
			delete: ({ id }) => {
				overrideServerBoards((boards) => {
					if (!boards) return boards;
					const index = boards.findIndex((board) => board.id === id);
					if (-1 === index) return boards;
					boards.splice(index, 1);
					return [...boards];
				});
			}
		}
	});

	return (
		<Show
			when={serverBoards() instanceof Error}
			fallback={<Project serverBoards={serverBoards()} />}
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
	// debugOwnerSignals();
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
		{ initialValue: [], name: 'boards' }
	);

	createComputed(() => {
		const $boards = boards.latest;
		untrack(() => {
			setAppContext('boards', $boards);
		});
	});

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<Show when={boards.latest.length > 0}>
				<div class="flex justify-end gap-4">
					<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Board</span>
					</Button>
				</div>
			</Show>
			<PathCrumbs />
			<Show
				when={boards.latest.length > 0}
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
					<Key each={boards.latest} by="id">
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
