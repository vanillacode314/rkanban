import { type } from 'arktype';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createEffect, createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from '~/components/ui/switch';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useTasks } from '~/queries/tasks';
import { parseFormErrors, throwOnParseError } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { handleFetchError } from '~/utils/errors';

export const [createTaskModalOpen, setCreateTaskModalOpen] = createSignal<boolean>(false);

const formSchema = type({
	appId: 'string',
	boardId: 'string.trim',
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	title: type('string.trim')
});
export default function CreateTaskModal() {
	const [appContext, _] = useApp();
	const board = () => appContext.currentBoard;

	const [, { createTask }] = useTasks(() => ({ enabled: false }));
	const [createMore, setCreateMore] = createSignal(false);

	createEffect(() =>
		setForm(
			create((draft) => {
				draft.appId = appContext.id;
				draft.boardId = board()?.id ?? '';
			})
		)
	);
	const [form, setForm] = createStore(
		throwOnParseError(
			formSchema({
				title: '',
				appId: appContext.id,
				boardId: board()?.id ?? '',
				id: nanoid()
			})
		)
	);

	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		title: [],
		id: [],
		appId: [],
		boardId: []
	});

	return (
		<BaseModal open={createTaskModalOpen()} setOpen={setCreateTaskModalOpen} title="Create Task">
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
										draft.title = '';
										draft.id = nanoid();
									})
								);
								toast.success(`Task created: ${result.title}`);
								if (!createMore()) close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="boardId" type="hidden" value={form.boardId} />
					<input name="id" type="hidden" value={form.id} />
					<input name="appId" type="hidden" value={form.appId} />
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
							placeholder="Title"
							required
							type="text"
							value={form.title}
						/>
						<ValidationErrors errors={formErrors.title} />
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
			)}
		</BaseModal>
	);
}
