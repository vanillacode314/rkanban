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
import { useBoardsByPath } from '~/queries/boards';
import { parseFormErrors } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { handleFetchError } from '~/utils/errors';

export const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal<boolean>(false);

const formSchema = type({
	appId: 'string',
	nodePath: 'string.trim',
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	title: type('string.trim')
});
export default function CreateBoardModal() {
	const [appContext, _] = useApp();
	const [id, setId] = createSignal(nanoid());
	const [, { createBoard }] = useBoardsByPath(() => ({ enabled: false, path: appContext.path }));
	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		title: [],
		id: [],
		appId: [],
		nodePath: []
	});

	return (
		<BaseModal open={createBoardModalOpen()} setOpen={setCreateBoardModalOpen} title="Create Board">
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
						createBoard.mutate(result, {
							onError: (error) => {
								const message = handleFetchError(
									{
										fallback: 'Failed to create board. Try again later if the issue persists'
									},
									error
								);
								setFormErrors({ form: [message] });
							},
							onSuccess: () => {
								setId(nanoid());
								toast.success(`Board created: ${result.title}`);
								close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="id" type="hidden" value={id()} />
					<input name="nodePath" type="hidden" value={appContext.path} />
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
						<Show when={createBoard.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg" />
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
