import { useAction } from '@solidjs/router';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createBoard } from '~/db/utils/boards';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal<boolean>(false);

export default function CreateBoardModal() {
	const [appContext, _setAppContext] = useApp();
	const $createBoard = useAction(createBoard);

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
						formData.set('title', await encryptWithUserKeys(formData.get('title') as string));
						await $createBoard(formData);
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
