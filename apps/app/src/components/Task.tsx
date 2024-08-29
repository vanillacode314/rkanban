import { revalidate, useAction } from '@solidjs/router';
import { Component } from 'solid-js';
import { toast } from 'solid-sonner';
import { useApp } from '~/context/app';
import { TBoard, TTask } from '~/db/schema';
import { getBoards } from '~/db/utils/boards';
import { deleteTask, shiftTask } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import { useConfirmModal } from './modals/auto-import/ConfirmModal';
import { setUpdateTaskModalOpen } from './modals/auto-import/UpdateTaskModal';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from './ui/dropdown-menu';

export const Task: Component<{
	boardId: TBoard['id'];
	task: Pick<TTask, 'id' | 'title' | 'index'>;
	class?: string;
	index: number;
}> = (props) => {
	return (
		<Card
			class={cn('group/task relative flex items-center gap-2 rounded p-4', props.class)}
			draggable="true"
			onDragStart={(event) => {
				event.dataTransfer?.setData('text/plain', String(props.task.id));
			}}
		>
			<span>{props.task.title}</span>
			<span class="grow" />
			<TaskContextMenu
				task={props.task}
				class="pointer-events-none opacity-0 transition-opacity group-hover/task:pointer-events-auto group-hover/task:opacity-100"
			/>
		</Card>
	);
};

function TaskContextMenu(props: { task: Pick<TTask, 'id' | 'title'>; class?: string }) {
	const [_appContext, setAppContext] = useApp();
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
						<DropdownMenuShortcut>
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
									formData.set('id', props.task.id.toString());
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
						<DropdownMenuShortcut>
							<span class="i-heroicons:trash"></span>
						</DropdownMenuShortcut>
					</DropdownMenuItem>
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
						<DropdownMenuShortcut>
							<span class="i-heroicons:arrow-long-down-solid"></span>
						</DropdownMenuShortcut>
					</DropdownMenuItem>
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
						<DropdownMenuShortcut>
							<span class="i-heroicons:arrow-long-up-solid"></span>
						</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
export default Task;
