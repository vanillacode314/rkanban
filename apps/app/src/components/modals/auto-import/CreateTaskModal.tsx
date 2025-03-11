import { type } from 'arktype';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal, { TModalSource } from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from '~/components/ui/switch';
import {
	TextField,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea
} from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useTasks } from '~/queries/tasks';
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
export const setCreateTaskModalOpen = (open: boolean, source: TModalSource = null) => {
	setModalData({ open, source });
};

const formSchema = type({
	boardId: 'string.trim',
	body: 'string.trim',
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	title: type('string.trim')
});
export default function CreateTaskModal() {
	const [appContext, _] = useApp();
	const board = () => appContext.currentBoard;

	const [, { createTask }] = useTasks(() => ({ enabled: false }));
	const [createMore, setCreateMore] = createSignal(false);

	const [{ form, formErrors }, { resetForm, setForm, setFormErrors }] = createForm(
		formSchema,
		() => ({
			title: '',
			boardId: board()?.id ?? '',
			id: nanoid(),
			body: ''
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
		createTask.mutate(result, {
			onError: (error) => {
				const message = handleFetchError(
					{
						fallback: 'Failed to create task. Try again later if the issue persists'
					},
					error
				);
				setFormErrors({ form: [message] });
			},
			onSuccess: () => {
				setForm(
					create((draft) => {
						Object.assign(draft, {
							title: '',
							body: '',
							id: nanoid()
						});
					})
				);
				toast.success(`Task created: ${result.title}`);
				if (!createMore()) setCreateTaskModalOpen(false);
			}
		});
	}

	return (
		<BaseModal
			fluid
			onOpenChange={(open) => open && resetForm()}
			open={modalData.open}
			setOpen={(value) => setCreateTaskModalOpen(value, modalData.source)}
			source={modalData.source}
			title="Create Task"
		>
			<form class="flex h-full flex-col gap-4" onSubmit={onSubmit}>
				<ValidationErrors errors={formErrors.form} />
				<input name="boardId" type="hidden" value={form.boardId} />
				<input name="id" type="hidden" value={form.id} />
				<TextField class="grid w-full items-center gap-1.5">
					<TextFieldLabel for="title">Title</TextFieldLabel>
					<TextFieldInput
						autocomplete="off"
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
						required
						type="text"
						value={form.title}
					/>
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
						value={form.body}
					/>
					<ValidationErrors errors={formErrors.body} />
				</TextField>
				<Switch checked={createMore()} class="flex items-center gap-x-2" onChange={setCreateMore}>
					<SwitchControl>
						<SwitchThumb />
					</SwitchControl>
					<SwitchLabel>Create More</SwitchLabel>
				</Switch>
				<Button class="flex items-center gap-2 self-end" type="submit">
					<Show when={createTask.isPending}>
						<span class="i-svg-spinners:180-ring-with-bg text-lg" />
					</Show>
					<span>Submit</span>
				</Button>
			</form>
		</BaseModal>
	);
}
