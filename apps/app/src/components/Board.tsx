import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
	attachClosestEdge,
	extractClosestEdge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { revalidate, useAction } from '@solidjs/router';
import { produce } from 'immer';
import { animate, spring } from 'motion';
import { Component, createSignal, onCleanup, onMount, ParentComponent, Show } from 'solid-js';
import { toast } from 'solid-sonner';

import { useApp } from '~/context/app';
import { useDirty } from '~/context/dirty';
import { TBoard, TTask } from '~/db/schema';
import { deleteBoard, getBoards, shiftBoard } from '~/db/utils/boards';
import { createTask } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import { onSubmission } from '~/utils/action';
import { decryptWithUserKeys } from '~/utils/auth.server';
import invariant from '~/utils/tiny-invariant';

import Decrypt from './Decrypt';
import { useConfirmModal } from './modals/auto-import/ConfirmModal';
import { setCreateTaskModalOpen } from './modals/auto-import/CreateTaskModal';
import { setUpdateBoardModalOpen } from './modals/auto-import/UpdateBoardModal';
import Task from './Task';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from './ui/dropdown-menu';

export const Board: Component<{
	board: { tasks: TTask[] } & TBoard;
	class?: string;
	index: number;
}> = (props) => {
	const [, setAppContext] = useApp();
	const [tasks, setTasks] = createWritableMemo(() => props.board.tasks);
	const [dragState, setDragState] = createSignal<'boards-drop' | 'tasks-drop' | null>(null);
	const [closestEdge, setClosestEdge] = createSignal<'left' | 'right'>('left');
	const [isDirty, _setIsDirty] = useDirty();
	let ref!: HTMLDivElement;
	let dragHandleRef!: HTMLDivElement;

	onSubmission(
		createTask,
		{
			onError(toastId: number | string | undefined) {
				toast.error('Error', { id: toastId });
			},
			onPending(input) {
				setTasks((tasks) =>
					produce(tasks, (tasks) => {
						tasks.push({
							boardId: props.board.id,
							createdAt: new Date(),
							id: String(input[0].get('id')),
							index: props.board.tasks.length + 1,
							title: String(input[0].get('title')),
							updatedAt: new Date(),
							userId: 'pending'
						});
					})
				);
				return toast.loading('Creating Task');
			},
			onSuccess(task, toastId) {
				decryptWithUserKeys(task.title).then((title) => {
					toast.success(`Created Task: ${title}`, { id: toastId });
				});
			}
		},
		{
			always: true,
			predicate: (input) => input[0].get('boardId') === props.board.id
		}
	);
	onMount(() => {
		const cleanup = combine(
			draggable({
				dragHandle: dragHandleRef,
				element: ref,
				getInitialData: () => ({ boardId: props.board.id, type: 'board' })
			}),
			dropTargetForElements({
				canDrop: ({ source }) => {
					if (source.data.type !== 'task' && source.data.type !== 'board') return false;
					if (source.data.boardId === props.board.id) return false;
					return true;
				},
				element: ref,
				getData: ({ element, input }) => {
					const data = { boardId: props.board.id, type: 'board' };
					return attachClosestEdge(data, { allowedEdges: ['right', 'left'], element, input });
				},
				getIsSticky: ({ source }) => source.data.type === 'board',
				onDrag: ({ self }) => {
					const edge = extractClosestEdge(self.data);
					invariant((edge && edge === 'right') || edge === 'left');
					setClosestEdge(edge);
				},
				onDragEnter: ({ source }) => {
					if (source.data.boardId === props.board.id) return;
					if (source.data.type === 'board') setDragState('boards-drop');
					if (source.data.type === 'task') setDragState('tasks-drop');
				},
				onDragLeave: () => setDragState(null),
				onDrop: () => {
					ref.scrollIntoView({ behavior: 'smooth' });
					setDragState(null);
				}
			})
		);
		onCleanup(cleanup);
	});

	return (
		<div class={cn('relative overflow-hidden', props.class)} ref={ref}>
			<div
				class={cn(
					'absolute inset-y-0 w-px bg-blue-300',
					dragState() === 'boards-drop' ? 'opacity-100' : 'opacity-0',
					closestEdge() === 'left' ? 'left-0' : 'right-0'
				)}
			/>
			<Card
				class={cn(
					'group/board flex h-full flex-col overflow-hidden transition-colors',
					dragState() === 'tasks-drop' && 'border-blue-300'
				)}
			>
				<CardHeader>
					<div class="grid grid-cols-[1fr_auto] items-center gap-4">
						<CardTitle class="flex items-center gap-2">
							<span
								class={cn(
									'i-akar-icons:drag-vertical shrink-0 cursor-move',
									props.board.userId === 'pending' && 'hidden'
								)}
								ref={dragHandleRef}
							/>
							<span
								class={cn(
									'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
									props.board.userId !== 'pending' && '!hidden'
								)}
							/>
							<Decrypt fallback value={props.board.title}>
								{(title) => <span>{title()}</span>}
							</Decrypt>
						</CardTitle>
						<div class={cn('flex items-center justify-end gap-2')}>
							<Button
								class="flex items-center gap-2"
								disabled={isDirty(['project', props.board.id])}
								onClick={() => {
									setCreateTaskModalOpen(true);
									setAppContext('currentBoard', props.board);
								}}
								size="icon"
								title="Create Task"
							>
								<span class="i-heroicons:plus text-lg" />
							</Button>
							<BoardContextMenu
								board={props.board}
								disabled={isDirty(['project', props.board.id])}
								index={props.index}
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent class="overflow-hidden">
					<Show fallback={<p>No tasks in this board</p>} when={tasks().length > 0}>
						<div class="flex h-full flex-col overflow-y-auto overflow-x-hidden">
							<AnimatedTaskList>
								<Key by="id" each={tasks()}>
									{(task, index) => <Task boardId={props.board.id} index={index()} task={task()} />}
								</Key>
							</AnimatedTaskList>
						</div>
					</Show>
				</CardContent>
			</Card>
		</div>
	);
};

const AnimatedTaskList: ParentComponent = (props) => {
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);
	const transition = createListTransition(resolved.toArray, {
		onChange({ added, finishRemoved, removed, unchanged }) {
			let removedCount = removed.length;
			for (const el of added) {
				queueMicrotask(() => {
					animate(el, { opacity: [0, 1], x: ['-100%', 0] }, { easing: spring() });
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
					animate(el, { opacity: [1, 0], x: [0, '-100%'] }, { easing: spring() }).finished.then(
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
	return <>{transition()}</>;
};

function BoardContextMenu(props: {
	board: { tasks: TTask[] } & TBoard;
	disabled?: boolean;
	index: number;
}) {
	const [appContext, setAppContext] = useApp();
	const confirmModal = useConfirmModal();
	const $deleteBoard = useAction(deleteBoard);

	return (
		<div class="flex-col">
			<DropdownMenu>
				<DropdownMenuTrigger
					as={Button<'button'>}
					disabled={props.disabled}
					size="icon"
					variant="ghost"
				>
					<span class="i-heroicons:ellipsis-vertical text-lg" />
				</DropdownMenuTrigger>
				<DropdownMenuContent class="w-48">
					<DropdownMenuItem
						as="button"
						class="w-full"
						onClick={() => {
							setAppContext('currentBoard', props.board);
							setUpdateBoardModalOpen(true);
						}}
					>
						<span>Edit</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:pencil-solid" />
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem
						as="button"
						class="w-full"
						onClick={() => {
							confirmModal.open({
								message: 'Are you sure you want to delete this board and all its tasks?',
								onYes: async () => {
									const formData = new FormData();
									formData.set('id', props.board.id.toString());
									formData.set('publisherId', appContext.id);
									toast.promise(() => $deleteBoard(formData), {
										error: 'Error',
										loading: 'Deleting Board',
										success: 'Deleted Board'
									});
								},
								title: 'Delete Board'
							});
						}}
					>
						<span>Delete</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:trash" />
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<Show when={props.index < appContext.boards.length - 1}>
						<DropdownMenuItem
							as="button"
							class="w-full"
							onClick={() => {
								toast.promise(
									async () => {
										await shiftBoard(props.board.id, 1);
										await revalidate(getBoards.key);
									},
									{
										error: 'Error',
										loading: 'Moving Board',
										success: 'Moved Board'
									}
								);
							}}
						>
							<span>Shift Right</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-right-solid" />
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</Show>
					<Show when={props.index > 0}>
						<DropdownMenuItem
							as="button"
							class="w-full"
							onClick={() => {
								toast.promise(
									async () => {
										await shiftBoard(props.board.id, -1);
										await revalidate(getBoards.key);
									},
									{
										error: 'Error',
										loading: 'Moving Board',
										success: 'Moved Board'
									}
								);
							}}
						>
							<span>Shift Left</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-left-solid" />
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</Show>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
export default Board;
