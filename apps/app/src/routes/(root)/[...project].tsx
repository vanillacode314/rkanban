import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { A, RouteDefinition, createAsync } from '@solidjs/router';
import { Show, createComputed, createMemo, untrack } from 'solid-js';
import Board from '~/components/Board';
import PathCrumbs from '~/components/PathCrumbs';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import { Button } from '~/components/ui/button';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { createBoard, getBoards } from '~/db/utils/boards';
import { onSubmission } from '~/utils/action';
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
	const [appContext, setAppContext] = useApp();
	const $boards = createAsync(() => getBoards(appContext.path));
	const [boards, overrideBoards] = createWritableMemo(() => $boards.latest);

	onSubmission(createBoard, {
		onPending(input) {
			overrideBoards((boards) => [
				...boards!,
				{
					id: String(input[0].get('id')),
					title: String(input[0].get('title')),
					tasks: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: 'pending',
					index: boards!.length,
					nodeId: 'pending'
				}
			]);
		}
	});

	createComputed(() => {
		const $boards = boards();
		untrack(() => {
			setAppContext('boards', $boards ?? []);
		});
	});

	createSubscription({
		tasks: {
			create: ({ data }) => {
				const task = data as TTask;
				overrideBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.id === task.boardId);
					if (!board) return boards;
					board.tasks.push(task);
					return [...boards];
				});
				// toast.info(`Another client create task: ${task.title}`);
			},
			update: ({ data }) => {
				const task = data as TTask;
				overrideBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.id === task.boardId);
					if (!board) return boards;
					const index = board.tasks.findIndex((t) => t.id === task.id);
					if (-1 === index) return boards;
					board.tasks[index] = task;
					return [...boards];
				});
				// toast.info(`Another client update task: ${task.title}`);
			},
			delete: ({ id }) => {
				overrideBoards((boards) => {
					if (!boards) return boards;
					const board = boards.find((board) => board.tasks.some((task) => task.id === id));
					if (!board) return boards;
					const taskIndex = board.tasks.findIndex((task) => task.id === id);
					if (-1 === taskIndex) return boards;
					board.tasks.splice(taskIndex, 1);
					return [...boards];
				});
				// toast.info('Another client deleted task');
			}
		},
		boards: {
			create: ({ data }) => {
				const board = { ...(data as TBoard), tasks: [] };
				overrideBoards((boards) => {
					if (!boards) return boards;
					boards.push(board);
					return [...boards];
				});
				// toast.info(`Another client created board: ${board.title}`);
			},
			update: ({ data }) => {
				const board = data as TBoard;
				overrideBoards((boards) => {
					if (!boards) return boards;
					const index = boards.findIndex((b) => b.id === board.id);
					if (-1 === index) return boards;
					boards[index] = { ...boards[index], ...board };
					return [...boards];
				});
				// toast.info(`Another client updated board: ${board.title}`);
			},
			delete: ({ id }) => {
				overrideBoards((boards) => {
					if (!boards) return boards;
					const index = boards.findIndex((board) => board.id === id);
					if (-1 === index) return boards;
					boards.splice(index, 1);
					return [...boards];
				});
				// toast.info('Another client deleted board');
			}
		}
	});

	return (
		<Show when={$boards.latest instanceof Error} fallback={<Project boards={$boards.latest} />}>
			<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
				<div>Project Not Found</div>
				<Button as={A} href="/">
					Go Home
				</Button>
			</div>
		</Show>
	);
}

function Project(props: { boards?: Array<TBoard & { tasks: TTask[] }> }) {
	const hasBoards = createMemo(() => props.boards && props.boards.length > 0);

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<Show when={hasBoards()}>
				<div class="flex justify-end gap-4">
					<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Board</span>
					</Button>
				</div>
			</Show>
			<PathCrumbs />
			<Show
				when={hasBoards()}
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
					<Key each={props.boards} by="id">
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
