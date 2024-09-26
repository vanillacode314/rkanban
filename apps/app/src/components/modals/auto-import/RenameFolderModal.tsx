import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';
import { onSubmission } from '~/utils/action';

export const [renameFolderModalOpen, setRenameFolderModalOpen] = createSignal<boolean>(false);

export default function RenameFolderModal() {
	const [appContext, _setAppContext] = useApp();

	const didDispatch = onSubmission(updateNode, {
		async onError(toastId: number | string | undefined, error) {
			if (error instanceof Error && error.message.startsWith('custom:'))
				toast.error(`${error.message.slice(7)}`, { id: toastId });
			else toast.error('Failed to rename folder', { id: toastId });
		},
		async onPending(input) {
			const name = String(input[0].get('name'));
			return toast.loading(`Renaming Folder: ${name}`);
		},
		async onSuccess(data, toastId) {
			toast.dismiss(toastId);
		}
	});

	let el!: HTMLFormElement;

	return (
		<BaseModal
			onOpenChange={(isOpen) =>
				isOpen && (el.querySelector('input[name="name"]') as HTMLInputElement).select()
			}
			open={renameFolderModalOpen()}
			setOpen={setRenameFolderModalOpen}
			title="Rename Folder"
		>
			{(close) => (
				<form
					action={updateNode}
					class="flex flex-col gap-4"
					method="post"
					onSubmit={() => didDispatch()}
					ref={el}
				>
					<input
						name="parentId"
						type="hidden"
						value={appContext.currentNode?.parentId ?? undefined}
					/>
					<input name="id" type="hidden" value={appContext.currentNode?.id} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autocomplete="off"
							autofocus
							id="name"
							name="name"
							placeholder="Name"
							required
							type="text"
							value={appContext.currentNode?.name}
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
