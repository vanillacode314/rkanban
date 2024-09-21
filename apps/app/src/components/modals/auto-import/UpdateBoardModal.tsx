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

	let toastId: number | string | undefined;
	createEffect(() => {
		const { pending, result } = submission;
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
						toast.error(result.message, { duration: 3000, id: toastId });
						break;
					default:
						console.error(result);
				}
			} else {
				toast.success('Updated Board', { duration: 3000, id: toastId });
			}
			toastId = undefined;
		});
	});

	return (
		<BaseModal open={updateBoardModalOpen()} setOpen={setUpdateBoardModalOpen} title="Update Board">
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
					<input name="id" type="hidden" value={board()?.id} />
					<input name="publisherId" type="hidden" value={appContext.id} />
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
