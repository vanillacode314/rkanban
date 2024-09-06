import { useAction } from '@solidjs/router';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createTask } from '~/db/utils/tasks';
import { encryptWithUserKeys } from '~/utils/auth.server';
import BaseModal from '../BaseModal';

export const [createTaskModalOpen, setCreateTaskModalOpen] = createSignal<boolean>(false);

export default function CreateTaskModal() {
	const [appContext, setAppContext] = useApp();
	const board = () => appContext.currentBoard;
	const $createTask = useAction(createTask);

	return (
		<BaseModal title="Create Task" open={createTaskModalOpen()} setOpen={setCreateTaskModalOpen}>
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
						formData.set('title', await encryptWithUserKeys(formData.get('title') as string));
						await $createTask(formData);
						idInput.value = nanoid();
					}}
				>
					<input type="hidden" name="boardId" value={board()?.id} />
					<input type="hidden" name="id" value={nanoid()} />
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
