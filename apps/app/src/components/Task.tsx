import {
	attachClosestEdge,
	extractClosestEdge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { revalidate, useAction } from '@solidjs/router';
import { animate, spring } from 'motion';
import { Component, createEffect, createSignal, onCleanup, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '~/components/ui/hover-card';
import { useApp } from '~/context/app';
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

export const Task: Component<{
	boardId: TBoard['id'];
	task: TTask;
	class?: string;
	index: number;
}> = (props) => {
	const [dragging, setDragging] = createSignal<boolean>(false);
	const [isBeingDraggedOver, setIsBeingDraggedOver] = createSignal<boolean>(false);
	const [closestEdge, setClosestEdge] = createSignal<'top' | 'bottom'>('bottom');

	return (
		<div
			class="relative overflow-hidden"
			ref={(el) => {
				const cleanup = combine(
					draggable({
						element: el,
						getInitialData: () => ({ boardId: props.boardId, taskId: props.task.id }),
						onDragStart: () => setDragging(true),
						onDrop: () => setDragging(false)
					}),
					dropTargetForElements({
						element: el,
						getIsSticky: () => true,
						canDrop({ source }) {
							return source.data.taskId !== props.task.id;
						},
						getData: ({ input, element }) => {
							const data = { boardId: props.boardId, taskId: props.task.id };
							return attachClosestEdge(data, { input, element, allowedEdges: ['top', 'bottom'] });
						},
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
			></div>
			<div
				class={cn(
					'relative flex cursor-move items-center border-l-4 pl-4 transition-colors hover:border-blue-400',
					dragging() ? 'opacity-0' : 'opacity-100',
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
							<Decrypt value={props.task.title} fallback>
								{(title) => <span class="text-sm">{title()}</span>}
							</Decrypt>
						</HoverCardTrigger>
						<HoverCardContent>
							<Decrypt value={props.task.title} fallback>
								{(title) => <span class="text-sm">{title()}</span>}
							</Decrypt>
						</HoverCardContent>
					</HoverCard>
				</span>
				<span class="grow" />
				<TaskContextMenu task={props.task} index={props.index} class="shrink-0" />
			</div>
			<div class="h-2"></div>
		</div>
	);
};

function TaskContextMenu(props: { task: TTask; class?: string; index: number }) {
	const [appContext, setAppContext] = useApp();
	const allTasks = () => appContext.boards.find((board) => board.id === props.task.boardId)!.tasks;
	const confirmModal = useConfirmModal();
	const $deleteTask = useAction(deleteTask);

	return (
		<div class={cn('flex-col', props.class)}>
			<DropdownMenu>
				<DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost">
					<span class="i-heroicons:ellipsis-vertical text-lg"></span>
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
							<span class="i-heroicons:pencil-solid"></span>
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem
						as="button"
						class="w-full"
						onClick={() => {
							confirmModal.open({
								title: 'Delete Task',
								message: 'Are you sure you want to delete this task?',
								onYes: async () => {
									const formData = new FormData();
									formData.set('id', props.task.id);
									formData.set('publisherId', appContext.id);
									toast.promise(() => $deleteTask(formData), {
										loading: 'Deleting Task',
										success: 'Deleted Task',
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
										loading: 'Moving Task',
										success: 'Moved Task',
										error: 'Error'
									}
								);
							}}
						>
							<span>Shift Down</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-down-solid"></span>
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
										loading: 'Moving Task',
										success: 'Moved Task',
										error: 'Error'
									}
								);
							}}
						>
							<span>Shift Up</span>
							<DropdownMenuShortcut class="text-base">
								<span class="i-heroicons:arrow-long-up-solid"></span>
							</DropdownMenuShortcut>
						</DropdownMenuItem>
					</Show>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
export default Task;
