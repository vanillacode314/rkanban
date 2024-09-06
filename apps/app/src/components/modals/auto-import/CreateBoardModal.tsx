import { useAction, useSubmissions } from '@solidjs/router';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createBoard } from '~/db/utils/boards';
import { encryptWithUserKeys } from '~/utils/auth.server';
import BaseModal from '../BaseModal';

export const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal<boolean>(false);

export default function CreateBoardModal() {
	const [appContext, setAppContext] = useApp();
	const submissions = useSubmissions(createBoard);
	const $createBoard = useAction(createBoard);

	return (
		<BaseModal title="Create Board" open={createBoardModalOpen()} setOpen={setCreateBoardModalOpen}>
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
						formData.set('title', await encryptWithUserKeys(formData.get('title') as string));
						await $createBoard(formData);
						idInput.value = nanoid();
					}}
				>
					<input type="hidden" name="id" value={nanoid()} />
					<input type="hidden" name="path" value={appContext.path} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<TextFieldInput
							autofocus
							type="text"
							id="title"
							name="title"
							placeholder="Title"
							autocomplete="off"
							required
						/>
					</TextField>
					<Button type="submit" class="self-end" onClick={close}>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
