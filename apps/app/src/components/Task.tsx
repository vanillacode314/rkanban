import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import {
	attachClosestEdge,
	extractClosestEdge
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { TBoard, TTask } from 'db/schema';
import { Component, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { toast } from 'solid-sonner';

import { useApp } from '~/context/app';
import { cn } from '~/lib/utils';
import { useTask } from '~/queries/tasks';
import { FetchError } from '~/utils/fetchers';
import invariant from '~/utils/tiny-invariant';

import Decrypt from './Decrypt';
import { useConfirmModal } from './modals/auto-import/ConfirmModal';
import { setUpdateTaskModalOpen } from './modals/auto-import/UpdateTaskModal';
import { Button } from './ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
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
	let ref!: HTMLDivElement;

	onMount(() => {
		const cleanup = combine(
			draggable({
				element: ref,
				getInitialData: () => ({ boardId: props.boardId, taskId: props.task.id, type: 'task' }),
				onDragStart: () => setDragging(true),
				onDrop: () => setDragging(false)
			}),
			dropTargetForElements({
				canDrop({ source }) {
					return source.data.type === 'task';
				},
				element: ref,
				getData: ({ element, input }) => {
					const data = { boardId: props.boardId, taskId: props.task.id, type: 'task' };
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
	});

	return (
		<div
			class={cn('relative shrink-0', dragging() ? 'opacity-30' : 'opacity-100', props.class)}
			ref={ref}
		>
			<div
				class={cn(
					'absolute inset-x-0 z-10 h-px w-full bg-blue-300',
					isBeingDraggedOver() ? 'opacity-100' : 'opacity-0',
					closestEdge() === 'top' ? 'top-0' : '-bottom-1'
				)}
			/>
			<div class="group relative flex min-h-10 cursor-move items-center rounded bg-secondary">
				<span class="flex items-center gap-2 overflow-hidden py-2 pl-4">
					<span
						class={cn(
							'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
							props.task.userId !== 'pending' && '!hidden'
						)}
					/>
					<Show
						fallback={<span class="text-sm">{props.task.title}</span>}
						when={props.task.userId !== 'pending'}
					>
						<Decrypt fallback value={props.task.title}>
							{(title) => <span class="text-sm">{title()}</span>}
						</Decrypt>
					</Show>
				</span>
				<span class="grow" />
				<TaskContextMenu
					class="shrink-0 can-hover:invisible group-hover:can-hover:visible"
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
	const [appContext, { setCurrentTask }] = useApp();
	const allTasks = () => appContext.boards.find((board) => board.id === props.task.boardId)!.tasks;
	const confirmModal = useConfirmModal();
	const [, { deleteTask, shiftTask, changeBoard }] = useTask(() => ({
		enabled: false,
		id: props.task.id
	}));

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
						onSelect={() => {
							setCurrentTask(props.task);
							setUpdateTaskModalOpen(true);
						}}
					>
						<span>Edit</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:pencil-solid" />
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => {
							confirmModal.open({
								message: 'Are you sure you want to delete this task?',
								onYes: () =>
									deleteTask.mutateAsync().catch(async (error) => {
										if (error instanceof FetchError) {
											const data = await error.response.json();
											if (data.message) {
												toast.error(data.message);
												return;
											}
										}
									}),
								title: 'Delete Task'
							});
						}}
					>
						<span>Delete</span>
						<DropdownMenuShortcut class="text-base">
							<span class="i-heroicons:trash" />
						</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSub overlap>
						<DropdownMenuSubTrigger>
							<span>Move to</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent>
								<For each={appContext.boards.filter((board) => board.id !== props.task.boardId)}>
									{(board) => (
										<DropdownMenuItem
											onSelect={() => {
												toast.promise(
													() =>
														changeBoard.mutateAsync({
															boardId: board.id,
															index: board.tasks.length
														}),
													{
														error: 'Error',
														loading: 'Moving Task',
														success: 'Moved Task'
													}
												);
											}}
										>
											<Decrypt fallback value={board.title}>
												{(title) => <>{title()}</>}
											</Decrypt>
										</DropdownMenuItem>
									)}
								</For>
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>
					<Show when={props.index < allTasks().length - 1}>
						<DropdownMenuItem
							onSelect={() => {
								toast.promise(() => shiftTask.mutateAsync(1), {
									error: 'Error',
									loading: 'Moving Task',
									success: 'Moved Task'
								});
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
							onSelect={() => {
								toast.promise(() => shiftTask.mutateAsync(-1), {
									error: 'Error',
									loading: 'Moving Task',
									success: 'Moved Task'
								});
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
