import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createNode } from '~/db/utils/nodes';
import { onSubmission } from '~/utils/action';

export const [createFileModalOpen, setCreateFileModalOpen] = createSignal<boolean>(false);

export default function CreateFileModal() {
	const [appContext, _setAppContext] = useApp();

	const didDispatch = onSubmission(createNode, {
		async onError(toastId: number | string | undefined, error) {
			if (error instanceof Error && error.message.startsWith('custom:'))
				toast.error(`${error.message.slice(7)}`, { id: toastId });
			else toast.error('Failed to create file', { id: toastId });
		},
		async onPending(input) {
			const name = String(input[0].get('name'));
			return toast.loading(`Creating File: ${name}`);
		},
		async onSuccess(data, toastId) {
			toast.success(`Created File: ${data.name}`, { id: toastId });
		}
	});

	return (
		<BaseModal open={createFileModalOpen()} setOpen={setCreateFileModalOpen} title="Create File">
			{(close) => (
				<form
					action={createNode}
					class="flex flex-col gap-4"
					method="post"
					onSubmit={async (event) => {
						const form = event.target as HTMLFormElement;
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
						const nameInput = form.querySelector('input[name="name"]') as HTMLInputElement;
						if (!nameInput.value.endsWith('.project'))
							nameInput.value = nameInput.value + '.project';
						idInput.value = nanoid();
						didDispatch();
					}}
				>
					<input name="parentPath" type="hidden" value={appContext.path} />
					<input name="id" type="hidden" value={nanoid()} />
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
