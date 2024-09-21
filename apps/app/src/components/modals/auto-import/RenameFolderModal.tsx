import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';
import { onSubmission } from '~/utils/action';
import BaseModal from '../BaseModal';

export const [renameFolderModalOpen, setRenameFolderModalOpen] = createSignal<boolean>(false);

export default function RenameFolderModal() {
	const [appContext, _setAppContext] = useApp();

	const didDispatch = onSubmission(updateNode, {
		async onPending(input) {
			const name = String(input[0].get('name'));
			return toast.loading(`Renaming Folder: ${name}`);
		},
		async onSuccess(data, toastId) {
			toast.dismiss(toastId);
		},
		async onError(toastId, error) {
			if (error instanceof Error && error.message.startsWith('custom:'))
				toast.error(`${error.message.slice(7)}`, { id: toastId });
			else toast.error('Failed to rename folder', { id: toastId });
		}
	});

	let el!: HTMLFormElement;

	return (
		<BaseModal
			title="Rename Folder"
			open={renameFolderModalOpen()}
			setOpen={setRenameFolderModalOpen}
			onOpenChange={(isOpen) =>
				isOpen && (el.querySelector('input[name="name"]') as HTMLInputElement).select()
			}
		>
			{(close) => (
				<form
					ref={el}
					action={updateNode}
					method="post"
					class="flex flex-col gap-4"
					onSubmit={() => didDispatch()}
				>
					<input
						type="hidden"
						name="parentId"
						value={appContext.currentNode?.parentId ?? undefined}
					/>
					<input type="hidden" name="id" value={appContext.currentNode?.id} />
					<input type="hidden" name="publisherId" value={appContext.id} />
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
					<Button type="submit" class="self-end" onClick={close}>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
