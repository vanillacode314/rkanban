import { useAction } from '@solidjs/router';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createTask } from '~/db/utils/tasks';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [createTaskModalOpen, setCreateTaskModalOpen] = createSignal<boolean>(false);

export default function CreateTaskModal() {
	const [appContext, _setAppContext] = useApp();
	const board = () => appContext.currentBoard;
	const $createTask = useAction(createTask);

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
						formData.set('title', await encryptWithUserKeys(String(formData.get('title'))));
						await $createTask(formData);
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
