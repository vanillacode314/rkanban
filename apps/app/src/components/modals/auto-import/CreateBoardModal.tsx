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
import { createBoard } from '~/db/utils/boards';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal<boolean>(false);

export default function CreateBoardModal() {
	const [appContext, _] = useApp();
	const $createBoard = useAction(createBoard);

	const queryClient = useQueryClient();
	const mutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			formData.set('title', await encryptWithUserKeys(String(formData.get('title'))));
			await $createBoard(formData);
		},
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['boards', context.path], context.previousData);
			toast.error('Failed to create board', { id: context.toastId });
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
					draft.push({
						createdAt: new Date(),
						id: String(formData.get('id')),
						index: draft!.length,
						nodeId: 'pending',
						tasks: [],
						title,
						updatedAt: new Date(),
						userId: 'pending'
					});
				})
			);
			const toastId = toast.loading(`Creating Board: ${title}`);
			return { path: appContext.path, previousData, title, toastId };
		},
		onSettled: (_, __, ___, context) => {
			if (!context) return;
			queryClient.invalidateQueries({ queryKey: ['boards', context.path] });
			toast.success(`Created Board: ${context.title}`, { id: context.toastId });
		}
	}));

	return (
		<BaseModal open={createBoardModalOpen()} setOpen={setCreateBoardModalOpen} title="Create Board">
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
					<input name="id" type="hidden" value={nanoid()} />
					<input name="path" type="hidden" value={appContext.path} />
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
