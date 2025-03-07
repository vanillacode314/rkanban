import { type } from 'arktype';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal, { TModalSource } from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useNodes } from '~/queries/nodes';
import { parseFormErrors } from '~/utils/arktype';
import { handleFetchError } from '~/utils/errors';
import { createForm } from '~/utils/form';

const [modalData, setModalData] = createStore<{
	open: boolean;
	source: TModalSource;
}>({
	open: false,
	source: null
});
export const setCreateFileModalOpen = (open: boolean, source: TModalSource = null) => {
	setModalData({ open, source });
};

const formSchema = type({
	name: type('string.trim')
		.narrow((name, ctx) => {
			if (!name.includes('/')) return true;
			return ctx.reject({
				problem: `cannot contain / (was "${name}")`
			});
		})
		.pipe((name) => {
			if (name === '') return name;
			if (name.endsWith('.project')) return name;
			return name + '.project';
		}),
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	parentId: 'string'
});
export default function CreateFileModal() {
	const [appContext, _setAppContext] = useApp();
	const [_nodes, { createNode }] = useNodes(() => ({ enabled: false }));

	const [{ form, formErrors }, { resetForm, setForm, setFormErrors }] = createForm(
		formSchema,
		() => ({
			name: '',
			parentId: appContext.currentNode?.id ?? '',
			id: nanoid()
		})
	);

	return (
		<BaseModal
			onOpenChange={(open) => open && resetForm()}
			open={modalData.open}
			setOpen={(value) => setCreateFileModalOpen(value, modalData.source)}
			source={modalData.source}
			title="Create File"
		>
			{(close) => (
				<form
					class="flex flex-col gap-4"
					method="post"
					onSubmit={(event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const result = formSchema(Object.fromEntries(new FormData(form)));
						if (result instanceof type.errors) {
							setFormErrors(parseFormErrors(result));
							return;
						}
						createNode.mutate(result, {
							onError: (error) => {
								const message = handleFetchError(
									{
										409: `File with name "${result.name}" already exists`,
										fallback: 'Failed to create file. Try again later if the issue persists'
									},
									error
								);
								setFormErrors({ form: [message] });
							},
							onSuccess: () => {
								setForm(
									create((draft) => {
										draft.id = nanoid();
									})
								);
								toast.success(`File created: ${result.name}`);
								close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="parentId" type="hidden" value={form.parentId} />
					<input name="id" type="hidden" value={form.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autocomplete="off"
							autofocus
							id="name"
							name="name"
							onInput={(event) =>
								setForm(
									create((draft) => {
										draft.name = event.currentTarget.value;
									})
								)
							}
							placeholder="Name"
							required
							type="text"
							value={form.name}
						/>
						<ValidationErrors errors={formErrors.name} />
					</TextField>
					<Button class="flex items-center gap-2 self-end" type="submit">
						<Show when={createNode.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg" />
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
