import { useAction } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';
import BaseModal from '../BaseModal';

export const [renameFileModalOpen, setRenameFileModalOpen] = createSignal<boolean>(false);

export default function RenameFileModal() {
	const [appContext, setAppContext] = useApp();
	const $updateNode = useAction(updateNode);

	return (
		<BaseModal title="Rename File" open={renameFileModalOpen()} setOpen={setRenameFileModalOpen}>
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						formData.set('name', String(formData.get('name')) + '.project');
						await $updateNode(formData);
					}}
				>
					<input type="hidden" name="parentId" value={appContext.currentNode?.parentId!} />
					<input type="hidden" name="id" value={appContext.currentNode?.id} />
					<input type="hidden" name="publisherId" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autofocus
							type="text"
							id="name"
							name="name"
							value={appContext.currentNode?.name.replace('.project', '')}
							placeholder="Name"
							autocomplete="off"
							required
						/>
					</TextField>
					<Button
						type="submit"
						class="self-end"
						onClick={() => {
							close();
							toast.loading('Renaming File');
						}}
					>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
