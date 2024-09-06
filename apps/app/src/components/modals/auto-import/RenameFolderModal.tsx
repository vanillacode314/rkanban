import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';
import BaseModal from '../BaseModal';

export const [renameFolderModalOpen, setRenameFolderModalOpen] = createSignal<boolean>(false);

export default function RenameFolderModal() {
	const [appContext, setAppContext] = useApp();

	return (
		<BaseModal
			title="Rename Folder"
			open={renameFolderModalOpen()}
			setOpen={setRenameFolderModalOpen}
		>
			{(close) => (
				<form action={updateNode} method="post" class="flex flex-col gap-4">
					<input type="hidden" name="parentId" value={appContext.currentNode?.parentId!} />
					<input type="hidden" name="id" value={appContext.currentNode?.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autofocus
							type="text"
							id="name"
							name="name"
							value={appContext.currentNode?.name}
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
							toast.loading('Renaming Folder');
						}}
					>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
