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
import { useBoard } from '~/queries/boards';
import { parseFormErrors } from '~/utils/arktype';
import { encryptWithUserKeys } from '~/utils/auth.server';
import { handleFetchError } from '~/utils/errors';

export const [updateBoardModalOpen, setUpdateBoardModalOpen] = createSignal<boolean>(false);

const formSchema = type({
	appId: 'string',
	id: type('string'),
	title: type('string.trim')
});
export default function UpdateBoardModal() {
	let el!: HTMLFormElement;

	const [appContext, _] = useApp();
	const board = () => appContext.currentBoard;

	const [, { updateBoard }] = useBoard(() => ({ enabled: false, id: board()?.id }));
	const [formErrors, setFormErrors] = createStore<
		Record<'form' | keyof typeof formSchema.infer, string[]>
	>({
		form: [],
		title: [],
		id: [],
		appId: []
	});

	return (
		<BaseModal
			onOpenChange={(isOpen) =>
				isOpen && (el.querySelector('input[name="title"]') as HTMLInputElement).select()
			}
			open={updateBoardModalOpen()}
			setOpen={setUpdateBoardModalOpen}
			title="Update Board"
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
						updateBoard.mutate(result, {
							onError: (error) => {
								const message = handleFetchError(
									{
										fallback: 'Failed to update baord. Try again later if the issue persists'
									},
									error
								);
								setFormErrors({ form: [message] });
							},
							onSuccess: () => {
								toast.success(`Board updated: ${result.title}`);
								close();
							}
						});
					}}
					ref={el}
				>
					<ValidationErrors errors={formErrors.form} />
					<input name="id" type="hidden" value={board()?.id} />
					<input name="appId" type="hidden" value={appContext.id} />
					<TextField class="grid w-full items-center gap-1.5">
						<TextFieldLabel for="title">Title</TextFieldLabel>
						<Decrypt value={board()?.title}>
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
						<Show when={updateBoard.isPending}>
							<span class="i-svg-spinners:180-ring-with-bg text-lg" />
						</Show>
						<span>Submit</span>
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
