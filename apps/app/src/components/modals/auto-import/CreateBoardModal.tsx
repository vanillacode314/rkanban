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
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useBoardsByPath } from '~/queries/boards';
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
export const setCreateBoardModalOpen = (open: boolean, source: TModalSource = null) => {
	setModalData({ open, source });
};

const formSchema = type({
	appId: 'string',
	nodePath: 'string.trim',
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	title: type('string.trim')
});
export default function CreateBoardModal() {
	const [appContext, _] = useApp();
	const [, { createBoard }] = useBoardsByPath(() => ({ enabled: false, path: appContext.path }));

	const [createMore, setCreateMore] = createSignal(false);

	const [{ form, formErrors }, { resetForm, setForm, setFormErrors }] = createForm(
		formSchema,
		() => ({
			title: '',
			appId: appContext.id,
			nodePath: appContext.path,
			id: nanoid()
		})
	);

	return (
		<BaseModal
			onOpenChange={(open) => open && resetForm()}
			open={modalData.open}
			setOpen={(value) => setCreateBoardModalOpen(value, modalData.source)}
			source={modalData.source}
			title="Create Board"
		>
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
								setForm(
									create((draft) => {
										draft.title = '';
										draft.id = nanoid();
									})
								);
								toast.success(`Board created: ${result.title}`);
								if (!createMore()) close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="id" type="hidden" value={form.id} />
					<input name="nodePath" type="hidden" value={form.nodePath} />
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
