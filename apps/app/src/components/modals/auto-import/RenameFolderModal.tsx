import { useAction } from '@solidjs/router';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { TNode } from 'db/schema';
import { create } from 'mutative';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { updateNode } from '~/db/utils/nodes';

export const [renameFolderModalOpen, setRenameFolderModalOpen] = createSignal<boolean>(false);

export default function RenameFolderModal() {
	const [appContext, _] = useApp();

	const queryClient = useQueryClient();
	const $updateNode = useAction(updateNode);

	const mutation = createMutation(() => ({
		mutationFn: $updateNode,
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['nodes', context.path], context.previousData);
			toast.error('Failed to rename folder', { id: context.toastId });
		},
		onMutate: async (formData) => {
			await queryClient.cancelQueries({ queryKey: ['nodes', appContext.path] });
			const previousData = queryClient.getQueryData<{ children: TNode[]; node: TNode }>([
				'nodes',
				appContext.path
			]);
			if (!previousData) return;
			queryClient.setQueryData(
				['nodes', appContext.path],
				create(previousData, (draft) => {
					const node = draft.children.find((node) => node.id === formData.get('id'));
					if (!node) return;
					node.name = String(formData.get('name'));
					node.userId = 'pending';
				})
			);
			const toastId = toast.loading(`Renaming Folder: ${formData.get('name')}`);
			return { path: appContext.path, previousData, toastId };
		},
		onSettled: (data, __, ___, context) => {
			if (!context) return;
			queryClient.invalidateQueries({ queryKey: ['nodes', context.path] });
			if (!data) return;
			toast.success(`Renamed Folder: ${data.name}`, { id: context.toastId });
		}
	}));

	let el!: HTMLFormElement;

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
					action={updateNode}
					class="flex flex-col gap-4"
					method="post"
					onSubmit={(event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						mutation.mutate(new FormData(form));
					}}
					ref={el}
				>
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
					</TextField>
					<Button class="self-end" onClick={close} type="submit">
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
