import { useAction } from '@solidjs/router';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { TBoard, TTask } from 'db/schema';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createTask } from '~/db/utils/tasks';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [createTaskModalOpen, setCreateTaskModalOpen] = createSignal<boolean>(false);

export default function CreateTaskModal() {
	const [appContext, {}] = useApp();
	const board = () => appContext.currentBoard;
	const $createTask = useAction(createTask);

	const queryClient = useQueryClient();
	const mutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			formData.set('title', await encryptWithUserKeys(String(formData.get('title'))));
			await $createTask(formData);
		},
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['boards', context.path], context.previousData);
			toast.error('Failed to create task', { id: context.toastId });
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
					const board = draft.find((board) => board.id === formData.get('boardId'));
					if (!board) return;
					board.tasks.push({
						boardId: board.id,
						createdAt: new Date(),
						id: String(formData.get('id')),
						index: board.tasks.length,
						title: String(formData.get('title')),
						updatedAt: new Date(),
						userId: 'pending'
					});
				})
			);
			const toastId = toast.loading(`Creating Task: ${title}`);
			return { path: appContext.path, previousData, title, toastId };
		},
		onSettled: (_, __, ___, context) => {
			if (!context) return;
			queryClient.invalidateQueries({ queryKey: ['boards', context.path] });
			toast.success(`Created Task: ${context.title}`, { id: context.toastId });
		}
	}));

	return (
		<BaseModal open={createTaskModalOpen()} setOpen={setCreateTaskModalOpen} title="Create Task">
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
						mutation.mutate(formData);
						idInput.value = nanoid();
					}}
				>
					<input name="boardId" type="hidden" value={board()?.id} />
					<input name="id" type="hidden" value={nanoid()} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<TextFieldInput
							autocomplete="off"
							autofocus
							id="title"
							name="title"
							placeholder="Title"
							required
							type="text"
						/>
					</TextField>
					<Button class="self-end" onClick={close} type="submit">
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
