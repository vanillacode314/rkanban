import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createNode } from '~/db/utils/nodes';
import { onSubmission } from '~/utils/action';
import BaseModal from '../BaseModal';

export const [createFileModalOpen, setCreateFileModalOpen] = createSignal<boolean>(false);

export default function CreateFileModal() {
	const [appContext, _setAppContext] = useApp();

	const didDispatch = onSubmission(createNode, {
		async onPending(input) {
			const name = String(input[0].get('name'));
			return toast.loading(`Creating File: ${name}`);
		},
		async onSuccess(data, toastId) {
			toast.success(`Created File: ${data.name}`, { id: toastId });
		},
		async onError(toastId, error) {
			if (error instanceof Error && error.message.startsWith('custom:'))
				toast.error(`${error.message.slice(7)}`, { id: toastId });
			else toast.error('Failed to create file', { id: toastId });
		}
	});

	return (
		<BaseModal title="Create File" open={createFileModalOpen()} setOpen={setCreateFileModalOpen}>
			{(close) => (
				<form
					action={createNode}
					method="post"
					class="flex flex-col gap-4"
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
					<input type="hidden" name="parentPath" value={appContext.path} />
					<input type="hidden" name="id" value={nanoid()} />
					<input type="hidden" name="publisherId" value={appContext.id} />
					<input type="hidden" name="isDirectory" value="false" />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autofocus
							type="text"
							id="name"
							name="name"
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
