import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
	attachClosestEdge,
	extractClosestEdge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { revalidate, useAction } from '@solidjs/router';
import { Component, createSignal, onCleanup, Show } from 'solid-js';
import { toast } from 'solid-sonner';

import { useApp } from '~/context/app';
import { useDirty } from '~/context/dirty';
import { TBoard, TTask } from '~/db/schema';
import { getBoards } from '~/db/utils/boards';
import { deleteTask, shiftTask } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import invariant from '~/utils/tiny-invariant';

import Decrypt from './Decrypt';
import { useConfirmModal } from './modals/auto-import/ConfirmModal';
import { setUpdateTaskModalOpen } from './modals/auto-import/UpdateTaskModal';
import { Button } from './ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from './ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card';

export const Task: Component<{
	boardId: TBoard['id'];
	class?: string;
	index: number;
	task: TTask;
}> = (props) => {
	const [dragging, setDragging] = createSignal<boolean>(false);
	const [isBeingDraggedOver, setIsBeingDraggedOver] = createSignal<boolean>(false);
	const [closestEdge, setClosestEdge] = createSignal<'bottom' | 'top'>('bottom');
	const [isDirty, _setIsDirty] = useDirty();

	return (
		<div
			class="relative shrink-0 overflow-hidden"
			ref={(el) => {
				const cleanup = combine(
					draggable({
						element: el,
						getInitialData: () => ({ boardId: props.boardId, taskId: props.task.id }),
						onDragStart: () => setDragging(true),
						onDrop: () => setDragging(false)
					}),
					dropTargetForElements({
						canDrop({ source }) {
							return source.data.taskId !== props.task.id;
						},
						element: el,
						getData: ({ element, input }) => {
							const data = { boardId: props.boardId, taskId: props.task.id };
							return attachClosestEdge(data, { allowedEdges: ['top', 'bottom'], element, input });
						},
						getIsSticky: () => true,
						onDrag: ({ self }) => {
							const edge = extractClosestEdge(self.data);
							invariant((edge && edge === 'top') || edge === 'bottom');
							setClosestEdge(edge);
						},
						onDragEnter: () => setIsBeingDraggedOver(true),
						onDragLeave: () => setIsBeingDraggedOver(false),
						onDrop: () => setIsBeingDraggedOver(false)
					})
				);
				onCleanup(cleanup);
			}}
		>
			<div
				class={cn(
					'absolute inset-x-0 h-px w-full bg-blue-400',
					isBeingDraggedOver() ? 'opacity-100' : 'opacity-0',
					closestEdge() === 'top' ? 'top-0' : 'bottom-2'
				)}
			/>
			<div
				class={cn(
					'relative flex h-10 cursor-move items-center border-l-4 pl-4 transition-colors hover:border-blue-400',
					dragging() ? 'opacity-30' : 'opacity-100',
					props.class
				)}
			>
				<span class="flex items-center gap-2 overflow-hidden">
					<span
						class={cn(
							'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
							props.task.userId === 'pending' ? 'inline-block' : '!hidden'
						)}
					/>
					<HoverCard>
						<HoverCardTrigger class="truncate">
							<Decrypt fallback value={props.task.title}>
								{(title) => <span class="text-sm">{title()}</span>}
							</Decrypt>
						</HoverCardTrigger>
						<HoverCardContent>
							<Decrypt fallback value={props.task.title}>
								{(title) => <span class="text-sm">{title()}</span>}
							</Decrypt>
						</HoverCardContent>
					</HoverCard>
				</span>
				<span class="grow" />
				<TaskContextMenu
					class={cn('shrink-0')}
					disabled={isDirty(['project', props.boardId, props.task.id])}
					index={props.index}
					task={props.task}
				/>
			</div>
			<div class="h-2" />
		</div>
	);
};

function TaskContextMenu(props: {
	class?: string;
	disabled?: boolean;
	index: number;
	task: TTask;
}) {
	const [appContext, setAppContext] = useApp();
	const allTasks = () => appContext.boards.find((board) => board.id === props.task.boardId)!.tasks;
	const confirmModal = useConfirmModal();
	const $deleteTask = useAction(deleteTask);

	return (
		<div class={cn('flex-col', props.class)}>
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
							setAppContext('currentTask', props.task);
							setUpdateTaskModalOpen(true);
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
								message: 'Are you sure you want to delete this task?',
								onYes: async () => {
									const formData = new FormData();
									formData.set('id', props.task.id);
									formData.set('publisherId', appContext.id);
									toast.promise(() => $deleteTask(formData), {
										error: 'Error',
										loading: 'Deleting Task',
										success: 'Deleted Task'
									});
								},
								title: 'Delete Task'
							});
						}}
					>
						<span>Delete</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:trash" />
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<Show when={props.index < allTasks().length - 1}>
						<DropdownMenuItem
							as="button"
							class="w-full"
							onClick={() => {
								toast.promise(
									async () => {
										await shiftTask(props.task.id, 1);
										await revalidate(getBoards.key);
									},
									{
										error: 'Error',
										loading: 'Moving Task',
										success: 'Moved Task'
									}
								);
							}}
						>
							<span>Shift Down</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-down-solid" />
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
										await shiftTask(props.task.id, -1);
										await revalidate(getBoards.key);
									},
									{
										error: 'Error',
										loading: 'Moving Task',
										success: 'Moved Task'
									}
								);
							}}
						>
							<span>Shift Up</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-up-solid" />
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</Show>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
export default Task;
