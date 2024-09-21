import { useAction, useSubmission } from '@solidjs/router';
import { createEffect, createSignal, untrack } from 'solid-js';
import { toast } from 'solid-sonner';

import Decrypt from '~/components/Decrypt';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateTask } from '~/db/utils/tasks';
import { encryptWithUserKeys } from '~/utils/auth.server';

export const [updateTaskModalOpen, setUpdateTaskModalOpen] = createSignal<boolean>(false);

export default function UpdateTaskModal() {
	const [appContext, _setAppContext] = useApp();
	const submission = useSubmission(updateTask);

	const task = () => appContext.currentTask;
	const $updateTask = useAction(updateTask);

	let toastId: number | string | undefined;
	createEffect(() => {
		const { pending, result } = submission;
		untrack(() => {
			if (pending) {
				if (toastId) toast.dismiss(toastId);
				toastId = toast.loading('Updating Task', {
					duration: Number.POSITIVE_INFINITY
				});
				return;
			}
			if (!result) return;
			if (result instanceof Error) {
				switch (result.cause) {
					case 'INVALID_CREDENTIALS':
						toast.error(result.message, { duration: 3000, id: toastId });
						break;
					default:
						console.error(result);
				}
			} else {
				toast.success('Updated Task', { duration: 3000, id: toastId });
			}
			toastId = undefined;
		});
	});

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
					<input name="publisherId" type="hidden" value={appContext.id} />
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
