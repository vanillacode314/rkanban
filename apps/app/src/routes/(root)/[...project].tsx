import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { Key } from '@solid-primitives/keyed';
import { createLazyMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, RouteDefinition } from '@solidjs/router';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { TBoard, TTask } from 'db/schema';
import { produce } from 'immer';
import { animate, AnimationControls, spring } from 'motion';
import {
	createEffect,
	createSignal,
	For,
	Match,
	mergeProps,
	onCleanup,
	onMount,
	ParentComponent,
	Setter,
	Show,
	Switch,
	untrack
} from 'solid-js';
import { toast } from 'solid-sonner';

import Board from '~/components/Board';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import PathCrumbs from '~/components/PathCrumbs';
import ProgressCircle from '~/components/ProgressCircle';
import { TransitionSlide } from '~/components/transitions/TransitionSlide';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { useDirty } from '~/context/dirty';
import { getBoards, moveBoards } from '~/db/utils/boards';
import { moveTasks } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import { createSubscription, makeSubscriptionHandler } from '~/utils/subscribe';
import invariant from '~/utils/tiny-invariant';

export const route: RouteDefinition = {
	matchFilters: {
		project: (pathname: string) =>
			pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	},
	preload: ({ location }) => {
		const queryClient = useQueryClient();
		queryClient.prefetchQuery({
			queryFn: ({ queryKey }) => getBoards(queryKey[1]),
			queryKey: ['boards', decodeURIComponent(location.pathname)]
		});
	}
};

export default function ProjectPage() {
	const [appContext, setAppContext] = useApp();

	const boardsQuery = createQuery(() => ({
		queryFn: ({ queryKey }) => getBoards(queryKey[1]),
		queryKey: ['boards', appContext.path]
	}));
	const hasBoards = () => boardsQuery.data && boardsQuery.data.length > 0;

	const boardsDirty = createLazyMemo(() => {
		if (boardsQuery.isPending) return false;
		const $boards = boardsQuery.data;
		if ($boards === undefined) return false;
		return $boards.some((board) =>
			board.tasks.some((task, index) => task.index !== index || task.boardId !== board.id)
		);
	});

	const [isDirty, setIsDirty] = useDirty();

	createEffect(() => setIsDirty('project', boardsDirty()));

	createEffect(() => {
		const $boards = boardsQuery.data;
		untrack(() => {
			setAppContext('boards', $boards ?? []);
		});
	});

	void createSubscription(makeSubscriptionHandler([getBoards.key]));

	return (
		<Switch>
			<Match when={boardsQuery.isPending}>
				<div class="relative flex h-full flex-col gap-4 overflow-hidden py-4">
					<div class="flex justify-end gap-4">
						<Skeleton height={40} radius={5} width={150} />
					</div>
					<PathCrumbs />
					<AnimatedBoardsList boards={boardsQuery.data!} setBoards={() => {}}>
						<For each={Array.from({ length: 3 })}>
							{() => (
								<Skeleton
									class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
									radius={5}
								/>
							)}
						</For>
					</AnimatedBoardsList>
				</div>
			</Match>
			<Match when={boardsQuery.isSuccess}>
				<Show
					fallback={
						<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
							<div>Project Not Found</div>
							<Button as={A} href="/">
								Go Home
							</Button>
						</div>
					}
					when={!(boardsQuery.data instanceof Error)}
				>
					<div class="relative flex h-full flex-col gap-4 overflow-hidden py-4">
						<ApplyChangesPopup
							boards={boardsQuery.data}
							boardsDirty={boardsDirty()}
							reset={() => boardsQuery.refetch()}
						/>
						<Show when={hasBoards()}>
							<div class="flex justify-end gap-4">
								<Button
									class="flex items-center gap-2"
									disabled={isDirty('project')}
									onClick={() => setCreateBoardModalOpen(true)}
								>
									<span class="i-heroicons:plus text-lg" />
									<span>Create Board</span>
								</Button>
							</div>
						</Show>
						<PathCrumbs />
						<Show
							fallback={
								<div class="relative isolate grid h-full place-content-center place-items-center gap-4 font-medium">
									<img
										class="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-5"
										src="/empty.svg"
									/>
									<span>Empty Project</span>
									<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
										<Button
											class="flex items-center gap-2"
											onClick={() => setCreateBoardModalOpen(true)}
										>
											<span class="i-heroicons:plus text-lg" />
											<span>Create Board</span>
										</Button>
									</div>
								</div>
							}
							when={hasBoards()}
						>
							<AnimatedBoardsList boards={boardsQuery.data!} setBoards={() => {}}>
								<Key by="id" each={boardsQuery.data}>
									{(board, index) => (
										<Board
											board={board()}
											class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
											index={index()}
										/>
									)}
								</Key>
								<SkeletonBoard class="hidden shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start md:flex" />
							</AnimatedBoardsList>
						</Show>
					</div>
				</Show>
			</Match>
		</Switch>
	);
}

const AnimatedBoardsList: ParentComponent<{
	boards: Array<{ tasks: TTask[] } & TBoard>;
	setBoards: Setter<Array<{ tasks: TTask[] } & TBoard> | undefined>;
}> = (props) => {
	const queryClient = useQueryClient();
	const [appContext, _setAppContext] = useApp();
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);
	const transition = createListTransition(resolved.toArray, {
		onChange({ added, finishRemoved, list: _list, removed, unchanged }) {
			let removedCount = removed.length;
			for (const el of added) {
				queueMicrotask(() => {
					animate(el, { opacity: [0, 1], width: [0, 'auto'] }, { easing: spring() });
				});
			}
			for (const el of removed) {
				const { height, left, top, width } = el.getBoundingClientRect();
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
	const [_isDirty, setIsDirty] = useDirty();

	let ref!: HTMLDivElement;
	onMount(() => {
		const cleanup = combine(
			// on drop board
			monitorForElements({
				canMonitor({ source }) {
					return source.data.type === 'board';
				},
				onDragStart: () => setIsBeingDragged(true),
				onDrop({ location, source }) {
					setIsBeingDragged(false);
					const destination = location.current.dropTargets[0];
					if (!destination) return;
					const closestEdgeOfTarget = extractClosestEdge(destination.data);

					const destinationIndex = props.boards.findIndex((b) => b.id === destination.data.boardId);
					const sourceIndex = props.boards.findIndex((b) => b.id === source.data.boardId);
					invariant(destinationIndex !== -1 && sourceIndex !== -1);

					props.setBoards((boards) =>
						reorderWithEdge({
							axis: 'horizontal',
							closestEdgeOfTarget,
							indexOfTarget: destinationIndex,
							list: boards!,
							startIndex: sourceIndex
						})
					);

					const changedBoards = [] as Parameters<typeof moveBoards>[1];

					for (const [index, board] of props.boards.entries()) {
						if (index === board.index) continue;
						changedBoards.push({ id: board.id, index });
					}

					if (changedBoards.length === 0) return;
					toast.promise(
						async () => {
							setIsDirty('project', true);
							await moveBoards(appContext.id, changedBoards)
								.then(() =>
									queryClient.invalidateQueries({ queryKey: ['boards', appContext.path] })
								)
								.finally(() => setIsDirty('project', false));
						},
						{
							error: 'Failed to move boards',
							loading: 'Moving boards...',
							success: 'Boards moved'
						}
					);
				}
			}),
			// on drop task
			monitorForElements({
				canMonitor({ source }) {
					return source.data.type === 'task';
				},
				onDragStart: () => setIsBeingDragged(true),
				onDrop({ location, source }) {
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

					if (destinationBoard === sourceBoard) {
						props.setBoards((boards) =>
							produce(boards, (boards) => {
								invariant(boards);
								const board = boards[destinationBoardIndex];
								board.tasks = reorderWithEdge({
									axis: 'vertical',
									closestEdgeOfTarget,
									indexOfTarget: destinationIndex,
									list: board.tasks,
									startIndex: sourceIndex
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
					return source.data.type === 'task' || source.data.type === 'board';
				},
				element: ref
			})
		);
		onCleanup(cleanup);
	});
	return (
		<div
			class={cn(
				'flex h-full gap-[var(--gap)] overflow-auto [--cols:1] [--gap:theme(spacing.4)] sm:[--cols:2] lg:[--cols:3] xl:[--cols:4]',
				isBeingDragged() ? '' : 'snap-x snap-mandatory'
			)}
			ref={ref}
		>
			{transition()}
		</div>
	);
};

function SkeletonBoard(props: { class?: string }) {
	const [isDirty, _setIsDirty] = useDirty();

	return (
		<Button
			class={cn('flex h-full w-full items-center gap-2', props.class)}
			disabled={isDirty('project')}
			onClick={() => setCreateBoardModalOpen(true)}
			variant="ghost"
		>
			<span class="i-heroicons:plus text-lg" />
			<span>Create Board</span>
		</Button>
	);
}

function ApplyChangesPopup(props: {
	boards: Array<{ tasks: TTask[] } & TBoard> | undefined;
	boardsDirty: boolean;
	countdownDuration?: number;
	reset: () => void;
}) {
	const queryClient = useQueryClient();
	const [appContext, _setAppContext] = useApp();
	const [count, setCount] = createSignal(0);
	const mergedProps = mergeProps({ countdownDuration: 3 }, props);
	let animation: AnimationControls;

	function startCountdown() {
		animation?.cancel();
		setCount(mergedProps.countdownDuration);
		animation = animate(
			(progress) => {
				setCount((1 - progress) * mergedProps.countdownDuration);
			},
			{ duration: mergedProps.countdownDuration, easing: 'linear' }
		);
		animation.finished.then(() => {
			const changedTasks = props.boards!.flatMap((board) => {
				const data = [];
				for (const [index, task] of board.tasks.entries()) {
					if (index === task.index && task.boardId === board.id) continue;
					data.push({ boardId: board.id, id: task.id, index });
				}
				return data;
			});
			if (changedTasks.length === 0) return;
			toast.promise(
				() =>
					moveTasks(appContext.id, changedTasks).then(() =>
						queryClient.invalidateQueries({ queryKey: ['boards', appContext.path] })
					),
				{
					error: 'Failed to apply changes',
					loading: 'Applying changes...',
					success: 'Changes applied'
				}
			);
		});
	}

	function reset() {
		animation?.cancel();
		props.reset();
	}

	async function apply() {
		animation?.finish();
	}

	createEffect(() => {
		if (props.boardsDirty) startCountdown();
		else animation?.cancel();
	});

	return (
		<TransitionSlide appear when={props.boardsDirty}>
			<div class="absolute left-1/2 top-4 flex -translate-x-1/2 items-center justify-center gap-2 rounded-lg border border-border p-2">
				<Button class="flex items-center gap-2" onClick={apply}>
					<Show
						fallback={<span class="i-heroicons:check-circle-solid shrink-0 text-xl" />}
						when={count() > 0}
					>
						<ProgressCircle
							class="text-xl"
							text={Math.ceil(count()).toString()}
							value={count() / mergedProps.countdownDuration}
						/>
					</Show>
					<span>Apply Changes</span>
				</Button>
				<Button class="flex items-center gap-2" onClick={reset} variant="secondary">
					<span class="i-heroicons:x-circle-solid shrink-0 text-xl" />
					<span>Cancel</span>
				</Button>
			</div>
		</TransitionSlide>
	);
}
