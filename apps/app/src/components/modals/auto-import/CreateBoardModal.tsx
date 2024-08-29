import { useSubmissions } from '@solidjs/router';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createBoard } from '~/db/utils/boards';
import BaseModal from '../BaseModal';

export const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal<boolean>(false);

export default function CreateBoardModal() {
	const [appContext, setAppContext] = useApp();
	const submissions = useSubmissions(createBoard);

	return (
		<BaseModal title="Create Board" open={createBoardModalOpen()} setOpen={setCreateBoardModalOpen}>
			{(close) => (
				<form
					action={createBoard}
					method="post"
					class="flex flex-col gap-4"
					onSubmit={(event) => {
						const form = event.target as HTMLFormElement;
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
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
					<Button
						type="submit"
						class="self-end"
						onClick={() => {
							close();
							toast.loading('Creating Board');
						}}
					>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
