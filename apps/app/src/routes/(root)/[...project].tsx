import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, RouteDefinition, createAsync, revalidate } from '@solidjs/router';
import { produce } from 'immer';
import { animate, spring } from 'motion';
import {
	ParentComponent,
	Setter,
	Show,
	createComputed,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	untrack
} from 'solid-js';
import { toast } from 'solid-sonner';
import Board from '~/components/Board';
import PathCrumbs from '~/components/PathCrumbs';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import { Button } from '~/components/ui/button';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { createBoard, getBoards } from '~/db/utils/boards';
import { moveTasks } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import { onSubmission } from '~/utils/action';
import { decryptWithUserKeys } from '~/utils/auth.server';
import { createSubscription } from '~/utils/subscribe';
import invariant from '~/utils/tiny-invariant';

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
	const [boards, setBoards] = createWritableMemo(() => $boards.latest);
	const hasBoards = () => boards() && boards()!.length > 0;
	const boardsDirty = createMemo(() => {
		const $boards = boards();
		if ($boards === undefined) return false;
		return $boards.some((board) =>
			board.tasks.some((task, index) => task.index !== index || task.boardId !== board.id)
		);
	});

	onSubmission(
		createBoard,
		{
			onPending(input) {
				setBoards((boards) =>
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
				setBoards((boards) =>
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
				setBoards((boards) =>
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
				setBoards((boards) =>
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
				setBoards((boards) =>
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
				setBoards((boards) =>
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
				setBoards((boards) =>
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
		<Show
			when={!(boards() instanceof Error)}
			fallback={
				<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
					<div>Project Not Found</div>
					<Button as={A} href="/">
						Go Home
					</Button>
				</div>
			}
		>
			<div class="relative flex h-full flex-col gap-4 overflow-hidden py-4">
				<Show when={boardsDirty()}>
					<div class="absolute left-1/2 top-4 flex -translate-x-1/2 place-content-center items-center justify-center gap-2 rounded-lg border border-border p-2">
						<Button
							class="flex items-center gap-2"
							onClick={async () => {
								toast.promise(
									() =>
										moveTasks(
											boards()!.flatMap((board) => {
												const data = [];
												for (const [index, task] of board.tasks.entries()) {
													if (index === task.index && task.boardId === board.id) continue;
													data.push({ id: task.id, index, boardId: board.id });
												}
												return data;
											})
										).then(() => revalidate(getBoards.key)),
									{
										loading: 'Applying changes...',
										success: 'Changes applied',
										error: 'Failed to apply changes'
									}
								);
							}}
						>
							<span class="i-heroicons:check-circle-solid shrink-0 text-xl"></span>
							<span>Apply Changes</span>
						</Button>
						<Button
							class="flex items-center gap-2"
							variant="secondary"
							onClick={() => {
								setBoards(() => $boards.latest);
							}}
						>
							<span class="i-heroicons:x-circle-solid shrink-0 text-xl"></span>
							<span>Cancel</span>
						</Button>
					</div>
				</Show>
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
								<Button
									class="flex items-center gap-2"
									onClick={() => setCreateBoardModalOpen(true)}
								>
									<span class="i-heroicons:plus text-lg"></span>
									<span>Create Board</span>
								</Button>
							</div>
						</div>
					}
				>
					<AnimatedBoardsList setBoards={setBoards} boards={boards()!}>
						<Key each={boards()} by="id">
							{(board, index) => (
								<Board
									class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
									board={board()}
									index={index()}
								/>
							)}
						</Key>
						<SkeletonBoard class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start" />
					</AnimatedBoardsList>
				</Show>
			</div>
		</Show>
	);
}

const AnimatedBoardsList: ParentComponent<{
	boards: Array<TBoard & { tasks: TTask[] }>;
	setBoards: Setter<Array<TBoard & { tasks: TTask[] }> | undefined>;
}> = (props) => {
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);
	const transition = createListTransition(resolved.toArray, {
		onChange({ list: _list, added, removed, unchanged, finishRemoved }) {
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

	const [isBeingDragged, setIsBeingDragged] = createSignal<boolean>(false);

	let el!: HTMLDivElement;
	onMount(() => {
		const cleanup = combine(
			monitorForElements({
				canMonitor({ source }) {
					return 'taskId' in source.data;
				},
				onDragStart: () => setIsBeingDragged(true),
				onDrop({ source, location }) {
					setIsBeingDragged(false);
					const destination = location.current.dropTargets[0];
					if (!destination) return;
					const closestEdgeOfTarget = extractClosestEdge(destination.data);

					const destinationBoardIndex = props.boards.findIndex(
						(b) => b.id === destination.data.boardId
					);
					const sourceBoardIndex = props.boards.findIndex((b) => b.id === source.data.boardId);
					const destinationBoard = props.boards[destinationBoardIndex];
					const sourceBoard = props.boards[sourceBoardIndex];
					invariant(sourceBoard && destinationBoard);

					const destinationIndex =
						destination.data.taskId === undefined ?
							destinationBoard.tasks.length
						:	destinationBoard.tasks.findIndex((task) => task.id === destination.data.taskId);
					const sourceIndex = sourceBoard.tasks.findIndex((task) => task.id === source.data.taskId);
					invariant(destinationIndex !== -1 && sourceIndex !== -1);
					console.log(sourceBoardIndex, destinationBoardIndex, sourceIndex, destinationIndex);

					if (destinationBoard === sourceBoard) {
						props.setBoards((boards) =>
							produce(boards, (boards) => {
								invariant(boards);
								const board = boards[destinationBoardIndex];
								board.tasks = reorderWithEdge({
									list: board.tasks,
									startIndex: sourceIndex,
									indexOfTarget: destinationIndex,
									closestEdgeOfTarget,
									axis: 'vertical'
								});
							})
						);
					} else {
						props.setBoards((boards) =>
							produce(boards, (boards) => {
								invariant(boards);
								const destinationBoard = boards[destinationBoardIndex];
								const sourceBoard = boards[sourceBoardIndex];
								const tasks = sourceBoard.tasks.splice(sourceIndex, 1);
								destinationBoard.tasks.splice(destinationIndex, 0, ...tasks);
							})
						);
					}
				}
			}),
			autoScrollForElements({
				canScroll({ source }) {
					return 'taskId' in source.data;
				},
				element: el
			})
		);
		onCleanup(cleanup);
	});
	return (
		<div
			ref={el}
			class={cn(
				'flex h-full gap-[var(--gap)] overflow-auto [--cols:1] [--gap:theme(spacing.4)] sm:[--cols:2] lg:[--cols:3] xl:[--cols:4]',
				isBeingDragged() ? '' : 'snap-x snap-mandatory'
			)}
		>
			{transition()}
		</div>
	);
};

function SkeletonBoard(props: { class?: string }) {
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
