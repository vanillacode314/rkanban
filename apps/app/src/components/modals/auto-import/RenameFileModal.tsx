import { useAction } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';
import { onSubmission } from '~/utils/action';
import BaseModal from '../BaseModal';

export const [renameFileModalOpen, setRenameFileModalOpen] = createSignal<boolean>(false);

export default function RenameFileModal() {
	let el!: HTMLFormElement;
	const [appContext, setAppContext] = useApp();
	const $updateNode = useAction(updateNode);

	const didDispatch = onSubmission(updateNode, {
		async onPending(input) {
			const name = String(input[0].get('name'));
			return toast.loading(`Renaming File: ${name}`);
		},
		async onSuccess(data, toastId) {
			toast.dismiss(toastId);
		},
		async onError(toastId, error) {
			if (error instanceof Error && error.message.startsWith('custom:'))
				toast.error(`${error.message.slice(7)}`, { id: toastId });
			else toast.error('Failed to rename file', { id: toastId });
		}
	});

	return (
		<BaseModal
			title="Rename File"
			open={renameFileModalOpen()}
			setOpen={setRenameFileModalOpen}
			onOpenChange={(isOpen) =>
				isOpen && (el.querySelector('input[name="name"]') as HTMLInputElement).select()
			}
		>
			{(close) => (
				<form
					ref={el}
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						const name = String(formData.get('name'));
						if (!name.endsWith('.project')) formData.set('name', name + '.project');
						didDispatch();
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
					<Button type="submit" class="self-end" onClick={close}>
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
