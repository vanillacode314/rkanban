import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, RouteDefinition, createAsync } from '@solidjs/router';
import { produce } from 'immer';
import { animate, spring } from 'motion';
import { ParentComponent, Show, createComputed, createMemo, untrack } from 'solid-js';
import { toast } from 'solid-sonner';
import Board from '~/components/Board';
import PathCrumbs from '~/components/PathCrumbs';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import { Button } from '~/components/ui/button';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { createBoard, getBoards } from '~/db/utils/boards';
import { cn } from '~/lib/utils';
import { onSubmission } from '~/utils/action';
import { decryptWithUserKeys } from '~/utils/auth.server';
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

	onSubmission(
		createBoard,
		{
			onPending(input) {
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						boards?.push({
							id: String(input[0].get('id')),
							title: String(input[0].get('title')),
							tasks: [],
							createdAt: new Date(),
							updatedAt: new Date(),
							userId: 'pending',
							index: boards!.length,
							nodeId: 'pending'
						});
					})
				);
				return toast.loading('Creating Board');
			},
			onError(toastId) {
				toast.error('Error', { id: toastId });
			},
			onSuccess(board, toastId) {
				decryptWithUserKeys(board.title).then((title) => {
					toast.success(`Created Board: ${title}`, { id: toastId });
				});
			}
		},
		{ always: true }
	);

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
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						const board = boards.find((board) => board.id === task.boardId);
						if (!board) return boards;
						board.tasks.push(task);
					})
				);
				decryptWithUserKeys(task.title).then((title) =>
					toast.info(`Another client created task: ${title}`)
				);
			},
			update: ({ data }) => {
				const task = data as TTask;
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						const board = boards.find((board) => board.id === task.boardId);
						if (!board) return boards;
						const index = board.tasks.findIndex((t) => t.id === task.id);
						if (-1 === index) return boards;
						board.tasks[index] = task;
					})
				);
				decryptWithUserKeys(task.title).then((title) =>
					toast.info(`Another client update task: ${title}`)
				);
			},
			delete: ({ id }) => {
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						const board = boards.find((board) => board.tasks.some((task) => task.id === id));
						if (!board) return boards;
						const taskIndex = board.tasks.findIndex((task) => task.id === id);
						if (-1 === taskIndex) return boards;
						board.tasks.splice(taskIndex, 1);
					})
				);
				toast.info('Another client deleted a task');
			}
		},
		boards: {
			create: ({ data }) => {
				const board = { ...(data as TBoard), tasks: [] };
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						boards.push(board);
					})
				);
				decryptWithUserKeys(board.title).then((title) =>
					toast.info(`Another client created board: ${title}`)
				);
			},
			update: ({ data }) => {
				const board = data as TBoard;
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						const index = boards.findIndex((b) => b.id === board.id);
						if (-1 === index) return boards;
						boards[index] = { ...boards[index], ...board };
					})
				);
				decryptWithUserKeys(board.title).then((title) =>
					toast.info(`Another client updated board: ${title}`)
				);
			},
			delete: ({ id }) => {
				overrideBoards((boards) =>
					produce(boards, (boards) => {
						if (!boards) return boards;
						const index = boards.findIndex((board) => board.id === id);
						if (-1 === index) return boards;
						boards.splice(index, 1);
					})
				);
				toast.info('Another client deleted board');
			}
		}
	});

	return (
		<Show when={boards() instanceof Error} fallback={<Project boards={boards()} />}>
			<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
				<div>Project Not Found</div>
				<Button as={A} href="/">
					Go Home
				</Button>
			</div>
		</Show>
	);
}

function SkeletonBoard(props: { class?: string; index: number }) {
	return (
		<Button
			variant="ghost"
			class={cn('flex h-full w-full items-center gap-2', props.class)}
			onClick={() => setCreateBoardModalOpen(true)}
		>
			<span class="i-heroicons:plus text-lg"></span>
			<span>Create Board</span>
		</Button>
	);
}

const AnimatedBoardsList: ParentComponent = (props) => {
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);
	const transition = createListTransition(resolved.toArray, {
		onChange({ list: _list, added, removed, unchanged, finishRemoved }) {
			console.log({ added, removed, unchanged });
			let removedCount = removed.length;
			for (const el of added) {
				queueMicrotask(() => {
					animate(el, { opacity: [0, 1], width: [0, 'auto'] }, { easing: spring() });
				});
			}
			for (const el of removed) {
				const { left, top, width, height } = el.getBoundingClientRect();
				queueMicrotask(() => {
					el.style.position = 'absolute';
					el.style.left = `${left}px`;
					el.style.top = `${top}px`;
					el.style.width = `${width}px`;
					el.style.height = `${height}px`;
					animate(el, { opacity: [1, 0], width: ['auto', 0] }, { easing: spring() }).finished.then(
						() => {
							removedCount -= 1;
							if (removedCount === 0) {
								finishRemoved(removed);
							}
						}
					);
				});
			}
			if (added.length === 0 && removed.length === 0) return;
			for (const el of unchanged) {
				const { left: left1, top: top1 } = el.getBoundingClientRect();
				if (!el.isConnected) return;
				queueMicrotask(() => {
					const { left: left2, top: top2 } = el.getBoundingClientRect();
					animate(el, { x: [left1 - left2, 0], y: [top1 - top2, 0] }, { easing: spring() });
				});
			}
		}
	});
	return (
		<div class="flex h-full snap-x snap-mandatory gap-[var(--gap)] overflow-auto [--cols:1] [--gap:theme(spacing.4)] sm:[--cols:2] lg:[--cols:3] xl:[--cols:4]">
			{transition()}
		</div>
	);
};

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
				<AnimatedBoardsList>
					<Key each={props.boards} by="id">
						{(board, index) => (
							<Board
								class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
								board={board()}
								index={index()}
							/>
						)}
					</Key>
					<SkeletonBoard
						index={props.boards?.length ?? 0}
						class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
					/>
				</AnimatedBoardsList>
			</Show>
		</div>
	);
}
