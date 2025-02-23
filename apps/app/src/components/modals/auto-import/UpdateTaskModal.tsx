import { type } from 'arktype';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import Decrypt from '~/components/Decrypt';
import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useTask } from '~/queries/tasks';
import { parseFormErrors } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { handleFetchError } from '~/utils/errors';

export const [updateTaskModalOpen, setUpdateTaskModalOpen] = createSignal<boolean>(false);

const formSchema = type({
	id: 'string',
	title: 'string.trim'
});
export default function UpdateTaskModal() {
	const [appContext, _] = useApp();
	const task = () => appContext.currentTask;
	const [, { updateTask }] = useTask(() => ({ enabled: false, id: task()?.id }));
	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		title: [],
		id: []
	});

	return (
		<BaseModal open={updateTaskModalOpen()} setOpen={setUpdateTaskModalOpen} title="Update Task">
			{(close) => (
				<form
					class="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const result = formSchema(Object.fromEntries(new FormData(form)));
						if (result instanceof type.errors) {
							setFormErrors(parseFormErrors(result));
							return;
						}

						result.title = await encryptWithUserKeys(result.title);
						updateTask.mutate(result, {
							onError: (error) => {
								const message = handleFetchError(
									{
										fallback: 'Failed to update task. Try again later if the issue persists'
									},
									error
								);
								setFormErrors({ form: [message] });
							},
							onSuccess: () => {
								toast.success(`Task updated`);
								close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
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
						<ValidationErrors errors={formErrors.title} />
					</TextField>
					<Button class="flex items-center gap-2 self-end" type="submit">
						<Show when={updateTask.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg" />
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
