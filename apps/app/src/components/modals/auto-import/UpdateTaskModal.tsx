import { useAction } from '@solidjs/router';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { TBoard, TTask } from 'db/schema';
import { create } from 'mutative';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import Decrypt from '~/components/Decrypt';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateTask } from '~/db/utils/tasks';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [updateTaskModalOpen, setUpdateTaskModalOpen] = createSignal<boolean>(false);

export default function UpdateTaskModal() {
	const [appContext, _setAppContext] = useApp();

	const task = () => appContext.currentTask;
	const $updateTask = useAction(updateTask);

	const queryClient = useQueryClient();
	const mutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			formData.set('title', await encryptWithUserKeys(String(formData.get('title'))));
			await $updateTask(formData);
		},
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['boards', context.path], context.previousData);
			toast.error('Failed to update task', { id: context.toastId });
		},
		onMutate: async (formData) => {
			await queryClient.cancelQueries({ queryKey: ['boards', appContext.path] });
			const previousData = queryClient.getQueryData<Array<{ tasks: TTask[] } & TBoard>>([
				'boards',
				appContext.path
			]);
			if (previousData === undefined) return;
			const title = String(formData.get('title'));
			queryClient.setQueryData(
				['boards', appContext.path],
				create(previousData, (draft) => {
					const board = draft.find((board) => board.id === appContext.currentTask?.boardId);
					if (!board) return;
					const task = board.tasks.find((task) => task.id === formData.get('id'));
					if (!task) return;
					task.title = title;
					task.userId = 'pending';
				})
			);
			const toastId = toast.loading(`Updating Task: ${title}`);
			return { path: appContext.path, previousData, title, toastId };
		},
		onSettled: (_, __, ___, context) => {
			if (!context) return;
			queryClient.invalidateQueries({ queryKey: ['boards', context.path] });
			toast.success(`Updated Task: ${context.title}`, { id: context.toastId });
		}
	}));

	return (
		<BaseModal open={updateTaskModalOpen()} setOpen={setUpdateTaskModalOpen} title="Update Task">
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						mutation.mutate(new FormData(form));
					}}
				>
					<input name="id" type="hidden" value={task()?.id} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<Decrypt value={task()?.title}>
							{(title) => (
								<TextFieldInput
									autofocus
									id="title"
									name="title"
									placeholder="Title"
									required
									type="text"
									value={title()}
								/>
							)}
						</Decrypt>
					</TextField>
					<Button class="self-end" onClick={close} type="submit">
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
