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
import { useNodes } from '~/queries/nodes';
import { parseFormErrors } from '~/utils/arktype';
import { FetchError } from '~/utils/fetchers';

export const [createFolderModalOpen, setCreateFolderModalOpen] = createSignal<boolean>(false);

const formSchema = type({
	name: type('string.trim')
		.narrow((name, ctx) => {
			if (!name.endsWith('.project')) return true;
			return ctx.reject({
				problem: `cannot end with .project (was "${name}")`
			});
		})
		.narrow((name, ctx) => {
			if (!name.includes('/')) return true;
			return ctx.reject({
				problem: `cannot contain / (was "${name}")`
			});
		}),
	id: type('string | undefined').pipe((v) => v ?? nanoid()),
	parentId: 'string'
});
export default function CreateFolderModal() {
	const [appContext, _] = useApp();
	const [id, setId] = createSignal(nanoid());
	const [_nodes, { createNode }] = useNodes(() => ({ enabled: false }));
	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		name: [],
		id: [],
		parentId: []
	});

	return (
		<BaseModal
			open={createFolderModalOpen()}
			setOpen={setCreateFolderModalOpen}
			title="Create Folder"
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
							onError: async (error) => {
								if (error instanceof FetchError) {
									const data = await error.response.json();
									if (data.message && data.message !== 'Error') {
										setFormErrors('form', [data.message]);
										return;
									}
									if (error.response.status === 409) {
										setFormErrors('form', ['Folder already exists']);
										return;
									}
								}
								setFormErrors('form', [
									`Failed to create folder. Try again later if the issue persists`
								]);
							},
							onSuccess: () => {
								setId(nanoid());
								toast.success(`Folder created: ${result.name}`);
								close();
							}
						});
					}}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="parentId" type="hidden" value={appContext.currentNode?.id} />
					<input name="id" type="hidden" value={id()} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="name">Name</TextFieldLabel>
						<TextFieldInput
							autocomplete="off"
							autofocus
							id="name"
							name="name"
							placeholder="Name"
							required
							type="text"
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
