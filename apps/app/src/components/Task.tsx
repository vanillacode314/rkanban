import { revalidate, useAction } from '@solidjs/router';
import { Component, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { getBoards } from '~/db/utils/boards';
import { deleteTask, shiftTask } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
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
	return (
		<div
			class={cn(
				'group/task relative flex items-center gap-2 rounded-none border-b-0 border-l-4 border-r-0 border-t-0 p-4 py-1 pr-0 transition-colors hover:border-l-blue-400',
				props.class
			)}
			draggable="true"
			onDragStart={(event) => {
				event.dataTransfer?.setData('text/plain', String(props.task.id));
			}}
		>
			<span class="flex items-center gap-2">
				<span
					class={cn(
						'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
						props.task.userId === 'pending' ? 'inline-block' : '!hidden'
					)}
				/>
				<Decrypt value={props.task.title} fallback>
					{(title) => <span>{title()}</span>}
				</Decrypt>
			</span>
			<span class="grow" />
			<TaskContextMenu task={props.task} index={props.index} />
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
