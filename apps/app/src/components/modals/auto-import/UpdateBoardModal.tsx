import { useAction, useSubmission } from '@solidjs/router';
import { createEffect, createSignal, untrack } from 'solid-js';
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
	const [appContext, _setAppContext] = useApp();
	const submission = useSubmission(updateBoard);

	const board = () => appContext.currentBoard;
	const $updateBoard = useAction(updateBoard);

	let toastId: string | number | undefined;
	createEffect(() => {
		const { result, pending } = submission;
		untrack(() => {
			if (pending) {
				if (toastId) toast.dismiss(toastId);
				toastId = toast.loading('Updating Board', {
					duration: Number.POSITIVE_INFINITY
				});
				return;
			}
			if (!result) return;
			if (result instanceof Error) {
				switch (result.cause) {
					case 'INVALID_CREDENTIALS':
						toast.error(result.message, { id: toastId, duration: 3000 });
						break;
					default:
						console.error(result);
				}
			} else {
				toast.success('Updated Board', { id: toastId, duration: 3000 });
			}
			toastId = undefined;
		});
	});

	return (
		<BaseModal title="Update Board" open={updateBoardModalOpen()} setOpen={setUpdateBoardModalOpen}>
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						const title = String(formData.get('title'));
						formData.set('title', await encryptWithUserKeys(title));
						await $updateBoard(formData);
					}}
				>
					<input type="hidden" name="id" value={board()?.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<Decrypt value={board()?.title}>
							{(title) => (
								<TextFieldInput
									autofocus
									type="text"
									id="title"
									name="title"
									placeholder="Title"
									value={title()}
									required
								/>
							)}
						</Decrypt>
					</TextField>
					<Button type="submit" class="self-end" onClick={close}>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
