import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import ValidationErrors from '~/components/form/ValidationErrors';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useTasks } from '~/queries/tasks';
import { parseFormErrors } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { FetchError } from '~/utils/fetchers';

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

	const [id, setId] = createSignal(nanoid());
	const [, { createTask }] = useTasks(() => ({ enabled: false }));

	const [formErrors, setFormErrors] = createStore<
		Record<keyof typeof formSchema.infer | 'form', string[]>
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
							onError: async (error) => {
								if (error instanceof FetchError) {
									const data = await error.response.json();
									if (data.message && data.message !== 'Error') {
										setFormErrors('form', [data.message]);
										return;
									}
								}
								setFormErrors('form', [
									`Failed to create task. Try again later if the issue persists`
								]);
							},
							onSuccess: () => {
								setId(nanoid());
								toast.success(`Task created: ${result.title}`);
								close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="boardId" type="hidden" value={board()?.id} />
					<input name="id" type="hidden" value={id()} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<TextFieldInput
							autocomplete="off"
							autofocus
							id="title"
							name="title"
							placeholder="Title"
							required
							type="text"
						/>
						<ValidationErrors errors={formErrors.title} />
					</TextField>
					<Button class="flex items-center gap-2 self-end" type="submit">
						<Show when={createTask.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg"></span>
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
