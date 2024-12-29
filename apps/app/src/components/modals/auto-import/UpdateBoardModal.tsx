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
import { updateBoard } from '~/db/utils/boards';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [updateBoardModalOpen, setUpdateBoardModalOpen] = createSignal<boolean>(false);

export default function UpdateBoardModal() {
	const [appContext, _] = useApp();

	const board = () => appContext.currentBoard;
	const $updateBoard = useAction(updateBoard);

	const queryClient = useQueryClient();
	const mutation = createMutation(() => ({
		mutationFn: async (formData: FormData) => {
			formData.set('title', await encryptWithUserKeys(String(formData.get('title'))));
			await $updateBoard(formData);
		},
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['boards', context.path], context.previousData);
			toast.error('Failed to update board', { id: context.toastId });
		},
		onMutate: async (formData) => {
			await queryClient.cancelQueries({ queryKey: ['boards', appContext.path] });
			const previousData = queryClient.getQueryData<Array<{ tasks: TTask[] } & TBoard>>([
				'boards',
				appContext.path
			]);
			if (!previousData) return;
			const title = String(formData.get('title'));
			queryClient.setQueryData(
				['boards', appContext.path],
				create(previousData, (draft) => {
					const board = draft.find((board) => board.id === formData.get('id'));
					if (!board) return;
					board.title = title;
					board.userId = 'pending';
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
		<BaseModal open={updateBoardModalOpen()} setOpen={setUpdateBoardModalOpen} title="Update Board">
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						mutation.mutate(new FormData(form));
					}}
				>
					<input name="id" type="hidden" value={board()?.id} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<Decrypt value={board()?.title}>
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
