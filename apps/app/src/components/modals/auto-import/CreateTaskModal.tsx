import { nanoid } from 'nanoid';
import { Show, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createTask } from '~/db/utils/tasks';
import BaseModal from '../BaseModal';

export const [createTaskModalOpen, setCreateTaskModalOpen] = createSignal<boolean>(false);

export default function CreateTaskModal() {
	const [appContext, setAppContext] = useApp();
	const board = () => appContext.currentBoard;

	return (
		<BaseModal title="Create Task" open={createTaskModalOpen()} setOpen={setCreateTaskModalOpen}>
			{(close) => (
				<Show when={board()}>
					<form
						action={createTask}
						method="post"
						class="flex flex-col gap-4"
						onSubmit={(event) => {
							const form = event.target as HTMLFormElement;
							const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
							idInput.value = nanoid();
						}}
					>
						<input type="hidden" name="boardId" value={board().id} />
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
						<Button
							type="submit"
							class="self-end"
							onClick={() => {
								close();
								toast.loading('Creating Task');
							}}
						>
							Submit
						</Button>
					</form>
				</Show>
			)}
		</BaseModal>
	);
}
