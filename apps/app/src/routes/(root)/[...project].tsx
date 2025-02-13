import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { reorderWithEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge';
import { Key } from '@solid-primitives/keyed';
import { createLazyMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { makePersisted, messageSync } from '@solid-primitives/storage';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, RouteDefinition } from '@solidjs/router';
import { useQueryClient } from '@tanstack/solid-query';
import { TBoard, TTask } from 'db/schema';
import { animate, spring } from 'motion';
import { create } from 'mutative';
import { deserialize, serialize } from 'seroval';
import {
	createEffect,
	createSignal,
	For,
	Match,
	mergeProps,
	onCleanup,
	onMount,
	ParentComponent,
	Show,
	Switch,
	untrack
} from 'solid-js';
import { toast } from 'solid-sonner';

import Board from '~/components/Board';
import Decrypt from '~/components/Decrypt';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import PathCrumbs from '~/components/PathCrumbs';
import ProgressCircle from '~/components/ProgressCircle';
import { TransitionSlide } from '~/components/transitions/TransitionSlide';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { useDirty } from '~/context/dirty';
import { cn } from '~/lib/utils';
import { useBoards, useBoardsByPath } from '~/queries/boards';
import invariant from '~/utils/tiny-invariant';
import { useTasks } from '~/queries/tasks';

export const route: RouteDefinition = {
	matchFilters: {
		project: (pathname: string) => {
			if (RESERVED_PATHS.includes(`/${pathname}`)) return false;
			if (!pathname.endsWith('.project')) return false;
			return true;
		}
	}
};

export default function ProjectPage() {
	const [appContext, { setBoards }] = useApp();
	const queryClient = useQueryClient();

	const [boardsQuery] = useBoardsByPath(() => ({ includeTasks: true, path: appContext.path }));
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
		untrack(() => setBoards($boards ?? []));
	});

	const [collapsedBoards, setCollapsedBoards] = makePersisted(
		createSignal<Map<string, TBoard>>(new Map()),
		{ deserialize, name: 'collapsed-boards-v1', serialize, sync: messageSync() }
	);

	return (
		<Switch>
			<Match when={boardsQuery.isPending}>
				<div class="relative flex h-full flex-col gap-4 overflow-hidden py-4">
					<div class="flex justify-end gap-4">
						<Skeleton height={40} radius={5} width={150} />
					</div>
					<PathCrumbs />
					<AnimatedBoardsList
						boards={[]}
						collapsedBoards={new Map()}
						setBoards={() => {}}
						setCollapsedBoards={() => {}}
					>
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
						{/* <ApplyChangesPopup */}
						{/* 	boards={boardsQuery.data} */}
						{/* 	boardsDirty={boardsDirty()} */}
						{/* 	reset={() => boardsQuery.refetch()} */}
						{/* /> */}
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
							<AnimatedBoardsList
								boards={boardsQuery.data!}
								collapsedBoards={
									new Map(
										Array.from(collapsedBoards()).filter(([id, _]) =>
											boardsQuery.data!.some((board) => board.id === id)
										)
									)
								}
								setBoards={(setter) => {
									queryClient.setQueryData(['boards', 'by-path', appContext.path, true], setter);
								}}
								setCollapsedBoards={(setter) => {
									setCollapsedBoards(setter);
								}}
							>
								<Key
									by="id"
									each={boardsQuery.data?.filter((board) => !collapsedBoards().has(board.id))}
								>
									{(board, index) => (
										<Board
											board={board()}
											class="shrink-0 basis-[calc((90%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
											index={index()}
										/>
									)}
								</Key>
								<SkeletonBoard class="hidden shrink-0 basis-[calc((90%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start md:flex" />
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
	collapsedBoards: Map<string, TBoard>;
	setBoards: (
		setter: (boards: Array<{ tasks: TTask[] } & TBoard>) => Array<{ tasks: TTask[] } & TBoard>
	) => void;
	setCollapsedBoards: (setter: (boards: Map<string, TBoard>) => Map<string, TBoard>) => void;
}> = (props) => {
	const queryClient = useQueryClient();
	const [appContext, _] = useApp();
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);

	const [, { shiftBoard }] = useBoards(() => ({ enabled: false }));
	const [, { changeBoard }] = useTasks(() => ({ enabled: false }));
	const transition = createListTransition(resolved.toArray, {
		onChange({ added, finishRemoved, list: _list, removed, unchanged }) {
			for (const el of added) {
				queueMicrotask(() => {
					animate(
						el,
						{ opacity: [0, 1], width: [0, 'auto'] },
						{ damping: 20, stiffness: 150, type: spring }
					);
				});
			}
			finishRemoved(removed);
			if (added.length === 0 && removed.length === 0) return;
			for (const el of unchanged) {
				const { left: left1, top: top1 } = el.getBoundingClientRect();
				if (!el.isConnected) return;
				queueMicrotask(() => {
					const { left: left2, top: top2 } = el.getBoundingClientRect();
					animate(
						el,
						{ x: [left1 - left2, 0], y: [top1 - top2, 0] },
						{ damping: 20, stiffness: 150, type: spring }
					);
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
					invariant(
						destinationIndex !== -1 && sourceIndex !== -1 && typeof source.data.boardId === 'string'
					);
					const direction = destinationIndex - sourceIndex;
					if (destinationIndex === sourceIndex) return;

					const reorderedBoards = reorderWithEdge({
						axis: 'horizontal',
						closestEdgeOfTarget,
						indexOfTarget: destinationIndex,
						list: props.boards,
						startIndex: sourceIndex
					});
					props.setBoards(() => reorderedBoards);

					toast.promise(
						async () => {
							setIsDirty('project', true);
							await shiftBoard
								.mutateAsync({ id: source.data.boardId, direction })
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
					if (sourceBoardIndex === destinationBoardIndex && sourceIndex === destinationIndex)
						return;

					if (destinationBoard === sourceBoard) {
						props.setBoards(
							create((boards) => {
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
						props.setBoards(
							create((boards) => {
								invariant(boards);
								const destinationBoard = boards[destinationBoardIndex];
								const sourceBoard = boards[sourceBoardIndex];
								const tasks = sourceBoard.tasks.splice(sourceIndex, 1);
								destinationBoard.tasks.splice(destinationIndex, 0, ...tasks);
							})
						);
					}

					toast.promise(
						async () => {
							setIsDirty('project', true);
							await changeBoard
								.mutateAsync({
									id: source.data.taskId,
									boardId: destination.data.boardId,
									index: destinationIndex
								})
								.finally(() => setIsDirty('project', false));
						},
						{
							error: 'Failed to move task',
							loading: 'Moving task...',
							success: 'Task moved'
						}
					);
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
			<div
				class={cn(
					'flex shrink-0 flex-col gap-2',
					props.collapsedBoards.size > 0 ?
						'basis-[calc((90%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start'
					:	'hidden'
				)}
			>
				<For each={Array.from(props.collapsedBoards).sort((a, b) => a[1].index - b[1].index)}>
					{([id, board]) => (
						<div class="flex items-center justify-between gap-4 rounded-lg border p-4 text-sm">
							<Decrypt value={board.title}>
								{(value) => <span class="font-bold">{value()}</span>}
							</Decrypt>
							<div class={cn('flex items-center justify-end gap-2')}>
								<button
									class="flex items-center gap-2"
									onClick={() => {
										props.setCollapsedBoards(
											create((boards) => {
												boards.delete(id);
											})
										);
									}}
									title="Expand Board"
								>
									<span class="i-heroicons:chevron-up" />
								</button>
							</div>
						</div>
					)}
				</For>
			</div>
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
	const [appContext, _] = useApp();
	const [count, setCount] = createSignal(0);
	const [, { shiftTask }] = useTasks(() => ({ enabled: false }));
	const mergedProps = mergeProps({ countdownDuration: 3 }, props);
	let animation: AnimationControls;

	function startCountdown() {
		animation?.cancel();
		setCount(mergedProps.countdownDuration);
		animation = animate(0, 1, {
			duration: mergedProps.countdownDuration,
			ease: 'linear',
			onUpdate: (progress) => {
				setCount((1 - progress) * mergedProps.countdownDuration);
			}
		});
		animation.then(() => {
			const hasTasksChanged = props.boards?.some((board) =>
				board.tasks.some((task, index) => task.index !== index || task.boardId !== board.id)
			);
			if (!hasTasksChanged) return;
			toast.promise(() => shiftTask({}), {
				error: 'Failed to apply changes',
				loading: 'Applying changes...',
				success: 'Changes applied'
			});
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
