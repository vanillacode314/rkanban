import { type } from 'arktype';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import ValidationErrors from '~/components/form/ValidationErrors';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { useNode } from '~/queries/nodes';
import { parseFormErrors } from '~/utils/arktype';
import { handleFetchError } from '~/utils/errors';

export const [renameFolderModalOpen, setRenameFolderModalOpen] = createSignal<boolean>(false);

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
	id: 'string',
	parentId: 'string'
});
export default function RenameFolderModal() {
	let el!: HTMLFormElement;

	const [appContext, _] = useApp();
	const [__, { updateNode }] = useNode(() => ({
		id: appContext.currentNode?.id,
		enabled: false
	}));

	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		id: [],
		name: [],
		parentId: []
	});

	return (
		<BaseModal
			onOpenChange={(isOpen) =>
				isOpen && (el.querySelector('input[name="name"]') as HTMLInputElement).select()
			}
			open={renameFolderModalOpen()}
			setOpen={setRenameFolderModalOpen}
			title="Rename Folder"
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
						updateNode.mutate(result, {
							onError: (error) => {
								const message = handleFetchError(
									{
										409: `Folder with name "${result.name}" already exists`,
										fallback: 'Failed to rename folder. Try again later if the issue persists'
									},
									error
								);
								setFormErrors({ form: [message] });
							},
							onSuccess: () => {
								toast.success(`Successfully renamed folder to ${result.name}`);
								close();
							}
						});
					}}
					ref={el}
				>
					<ValidationErrors errors={formErrors.form} />
					<input
						name="parentId"
						type="hidden"
						value={appContext.currentNode?.parentId ?? undefined}
					/>
					<input name="id" type="hidden" value={appContext.currentNode?.id} />
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
							value={appContext.currentNode?.name}
						/>
						<ValidationErrors errors={formErrors.name} />
					</TextField>
					<Button class="flex items-center gap-2 self-end" type="submit">
						<Show when={updateNode.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg" />
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
