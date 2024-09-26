import { useAction } from '@solidjs/router';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import Decrypt from '~/components/Decrypt';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateTask } from '~/db/utils/tasks';
import { onSubmission } from '~/utils/action';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [updateTaskModalOpen, setUpdateTaskModalOpen] = createSignal<boolean>(false);

export default function UpdateTaskModal() {
	const [appContext, _setAppContext] = useApp();

	const task = () => appContext.currentTask;
	const $updateTask = useAction(updateTask);

	onSubmission(
		updateTask,
		{
			onError(toastId: number | string | undefined, error) {
				if (!(error instanceof Error)) return;
				switch (error.cause) {
					case 'INVALID_CREDENTIALS':
						toast.error(error.message, { duration: 3000, id: toastId });
						break;
					default:
						console.error(error);
				}
			},
			onPending() {
				return toast.loading('Updating Task', {
					duration: Number.POSITIVE_INFINITY
				});
			},
			onSuccess(_, toastId) {
				toast.success('Updated Task', { duration: 3000, id: toastId });
			}
		},
		{ always: true }
	);

	return (
		<BaseModal open={updateTaskModalOpen()} setOpen={setUpdateTaskModalOpen} title="Update Task">
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const formData = new FormData(form);
						formData.set('title', await encryptWithUserKeys(formData.get('title') as string));
						await $updateTask(formData);
					}}
				>
					<input name="id" type="hidden" value={task()?.id} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<Decrypt value={task()?.title}>
							{(title) => (
								<TextFieldInput
									autofocus
									id="title"
									name="title"
									placeholder="Title"
									required
									type="text"
									value={title()}
								/>
							)}
						</Decrypt>
					</TextField>
					<Button class="self-end" onClick={close} type="submit">
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
