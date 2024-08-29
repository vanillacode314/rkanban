import { useSubmission } from '@solidjs/router';
import { Show, createEffect, createSignal, untrack } from 'solid-js';
import { toast } from 'solid-sonner';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateTask } from '~/db/utils/tasks';

export const [updateTaskModalOpen, setUpdateTaskModalOpen] = createSignal<boolean>(false);

export default function UpdateTaskModal() {
	const [appContext, _setAppContext] = useApp();
	const submission = useSubmission(updateTask);

	const task = () => appContext.currentTask;

	let toastId: string | number | undefined;
	createEffect(() => {
		const { result, pending } = submission;
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
						toast.error(result.message, { id: toastId, duration: 3000 });
						break;
					default:
						console.error(result);
				}
			} else {
				toast.success('Updated Task', { id: toastId, duration: 3000 });
			}
			toastId = undefined;
		});
	});

	return (
		<BaseModal title="Update Task" open={updateTaskModalOpen()} setOpen={setUpdateTaskModalOpen}>
			{(close) => (
				<Show when={task()}>
					<form action={updateTask} method="post" class="flex flex-col gap-4">
						<input type="hidden" name="id" value={task().id} />
						<TextField class="grid w-full items-center gap-1.5">
							<TextFieldLabel for="title">Title</TextFieldLabel>
							<TextFieldInput
								autofocus
								type="text"
								id="title"
								name="title"
								placeholder="Title"
								value={task().title}
							/>
						</TextField>
						<Button type="submit" class="self-end" onClick={close}>
							Submit
						</Button>
					</form>
				</Show>
			)}
		</BaseModal>
	);
}
