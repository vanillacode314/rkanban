import { type } from 'arktype';
import { create } from 'mutative';
import { Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import Decrypt from '~/components/Decrypt';
import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal, { TModalSource } from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea
} from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useTask } from '~/queries/tasks';
import { parseFormErrors } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { handleFetchError } from '~/utils/errors';
import { createForm } from '~/utils/form';

const [modalData, setModalData] = createStore<{
	open: boolean;
	source: TModalSource;
}>({
	open: false,
	source: null
});
export const setUpdateTaskModalOpen = (open: boolean, source: TModalSource = null) => {
	setModalData({ open, source });
};

const formSchema = type({
	id: 'string',
	title: 'string.trim',
	body: 'string.trim'
});
export default function UpdateTaskModal() {
	const [appContext, _] = useApp();
	const task = () => appContext.currentTask;
	const [, { updateTask }] = useTask(() => ({ enabled: false, id: task()?.id }));
	const [{ form, formErrors }, { resetForm, setForm, setFormErrors }] = createForm(
		formSchema,
		() => ({
			body: task()?.body ?? '',
			title: task()?.title ?? '',
			id: task()?.id ?? ''
		})
	);
	async function onSubmit(event: SubmitEvent) {
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
				setUpdateTaskModalOpen(false);
			}
		});
	}

	return (
		<BaseModal
			fluid
			onOpenChange={(open) => open && resetForm()}
			open={modalData.open}
			setOpen={(v) => setUpdateTaskModalOpen(v, modalData.source)}
			source={modalData.source}
			title="Update Task"
		>
			<form class="flex h-full flex-col gap-4" onSubmit={onSubmit}>
				<ValidationErrors errors={formErrors.form} />
				<input name="id" type="hidden" value={form.id} />
				<TextField class="grid w-full items-center gap-1.5">
					<TextFieldLabel for="title">Title</TextFieldLabel>
					<Decrypt value={form.title}>
						{(title) => (
							<TextFieldInput
								autofocus
								id="title"
								name="title"
								onInput={(event) =>
									setForm(
										create((draft) => {
											draft.title = event.currentTarget.value;
										})
									)
								}
								placeholder="Title"
								required
								type="text"
								value={title()}
							/>
						)}
					</Decrypt>
					<ValidationErrors errors={formErrors.title} />
				</TextField>
				<TextField class="flex h-full flex-col gap-1.5">
					<TextFieldLabel for="title">Body</TextFieldLabel>
					<TextFieldTextArea
						autocomplete="off"
						autofocus
						class="grow"
						id="body"
						name="body"
						onInput={(event) =>
							setForm(
								create((draft) => {
									draft.body = event.currentTarget.value;
								})
							)
						}
						placeholder=""
						value={form.body}
					/>
					<ValidationErrors errors={formErrors.body} />
				</TextField>
				<span class="grow" />
				<Button class="flex items-center gap-2 self-end" type="submit">
					<Show when={updateTask.isPending}>
						<span class="i-svg-spinners:180-ring-with-bg text-lg" />
					</Show>
					<span>Submit</span>
				</Button>
			</form>
		</BaseModal>
	);
}
