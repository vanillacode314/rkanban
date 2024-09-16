import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { createAsync, revalidate, useAction } from '@solidjs/router';
import { produce } from 'immer';
import { animate, spring } from 'motion';
import { Component, createSignal, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { deleteBoard, getBoards, shiftBoard } from '~/db/utils/boards';
import { createTask, moveTask } from '~/db/utils/tasks';
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

export const Board: Component<{
	class?: string;
	board: TBoard & { tasks: TTask[] };
	index: number;
}> = (props) => {
	const [_appContext, setAppContext] = useApp();
	const [tasks, setTasks] = createWritableMemo(() => props.board.tasks);
	const [isDraggedOver, setIsDraggedOver] = createSignal<boolean>(false);

	onSubmission(
		createTask,
		{
			onPending(input) {
				setTasks((tasks) =>
					produce(tasks, (tasks) => {
						tasks.push({
							title: String(input[0].get('title')),
							id: String(input[0].get('id')),
							userId: 'pending',
							index: props.board.tasks.length + 1,
							createdAt: new Date(),
							updatedAt: new Date(),
							boardId: props.board.id
						});
					})
				);
				return toast.loading('Creating Task');
			},
			onSuccess(task, toastId) {
				decryptWithUserKeys(task.title).then((title) => {
					toast.success(`Created Task: ${title}`, { id: toastId });
				});
			},
			onError(toastId) {
				toast.error('Error', { id: toastId });
			}
		},
		{
			predicate: (input) => input[0].get('boardId') === props.board.id,
			always: true
		}
	);

	const title = createAsync(() => decryptWithUserKeys(props.board.title));

	return (
		<Card
			class={cn(
				'group/board flex h-full flex-col overflow-hidden transition-colors',
				isDraggedOver() ? 'border-blue-300' : '',
				props.class
			)}
			ref={(el) => {
				dropTargetForElements({
					element: el,
					canDrop: ({ source }) => {
						invariant(
							source.data.taskId && source.data.boardId && typeof source.data.taskId === 'string'
						);
						if (source.data.boardId === props.board.id) return false;
						return true;
					},
					onDragEnter: ({ source }) => {
						if (source.data.boardId === props.board.id) return;
						setIsDraggedOver(true);
					},
					onDragLeave: () => setIsDraggedOver(false),
					onDrop: ({ source }) => {
						setIsDraggedOver(false);

						toast.promise(
							async () => {
								const task = await moveTask(source.data.taskId as string, props.board.id);
								await revalidate(getBoards.key);
								return task;
							},
							{
								loading: 'Moving',
								success: `Moved task to board: ${title()}`,
								error: 'Error'
							}
						);
					}
				});
			}}
		>
			<CardHeader>
				<div class="grid grid-cols-[1fr_auto] items-center gap-4">
					<CardTitle class="flex items-center gap-2">
						<span
							class={cn(
								'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
								props.board.userId === 'pending' ? 'inline-block' : '!hidden'
							)}
						/>
						<Decrypt value={props.board.title} fallback>
							{(title) => <span>{title()}</span>}
						</Decrypt>
					</CardTitle>
					<div class="flex items-center justify-end gap-2">
						<Button
							class="flex items-center gap-2"
							title="Create Task"
							size="icon"
							onClick={() => {
								setCreateTaskModalOpen(true);
								setAppContext('currentBoard', props.board);
							}}
						>
							<span class="i-heroicons:plus text-lg"></span>
						</Button>
						<BoardContextMenu board={props.board} index={props.index} />
					</div>
				</div>
			</CardHeader>
			<CardContent class="overflow-hidden">
				<AnimatedTaskList boardId={props.board.id} tasks={tasks()} />
			</CardContent>
		</Card>
	);
};

const AnimatedTaskList = (props: { boardId: TBoard['id']; tasks: TTask[] }) => {
	const resolved = resolveElements(
		() => (
			<Key each={props.tasks} by="id">
				{(task, index) => (
					<Task task={task()} boardId={props.boardId} class="origin-top" index={index()} />
				)}
			</Key>
		),
		(el): el is HTMLElement => el instanceof HTMLElement
	);
	const transition = createListTransition(resolved.toArray, {
		onChange({ list: _list, added, removed, unchanged, finishRemoved }) {
			let removedCount = removed.length;
			for (const el of added) {
				queueMicrotask(() => {
					animate(el, { opacity: [0, 1], x: ['-100%', 0] }, { easing: spring() });
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
	return (
		<Show when={props.tasks.length > 0} fallback={<p>No tasks in this board</p>}>
			<div class="flex h-full flex-col gap-2 overflow-y-auto overflow-x-hidden">{transition()}</div>
		</Show>
	);
};

function BoardContextMenu(props: { board: TBoard & { tasks: TTask[] }; index: number }) {
	const [appContext, setAppContext] = useApp();
	const confirmModal = useConfirmModal();
	const $deleteBoard = useAction(deleteBoard);

	return (
		<div class="flex-col">
			<DropdownMenu>
				<DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost">
					<span class="i-heroicons:ellipsis-vertical text-lg"></span>
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
							<span class="i-heroicons:pencil-solid"></span>
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem
						as="button"
						class="w-full"
						onClick={() => {
							confirmModal.open({
								title: 'Delete Board',
								message: 'Are you sure you want to delete this board and all its tasks?',
								onYes: async () => {
									const formData = new FormData();
									formData.set('id', props.board.id.toString());
									formData.set('publisherId', appContext.id);
									toast.promise(() => $deleteBoard(formData), {
										loading: 'Deleting Board',
										success: 'Deleted Board',
										error: 'Error'
									});
								}
							});
						}}
					>
						<span>Delete</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:trash"></span>
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
										loading: 'Moving Board',
										success: 'Moved Board',
										error: 'Error'
									}
								);
							}}
						>
							<span>Shift Right</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-right-solid"></span>
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
										loading: 'Moving Board',
										success: 'Moved Board',
										error: 'Error'
									}
								);
							}}
						>
							<span>Shift Left</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-left-solid"></span>
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</Show>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
export default Board;
