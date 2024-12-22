import { useAction } from '@solidjs/router';
import { createMutation, useQueryClient } from '@tanstack/solid-query';
import { TNode } from 'db/schema';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createSignal } from 'solid-js';
import { toast } from 'solid-sonner';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { useApp } from '~/context/app';
import { createNode } from '~/db/utils/nodes';

export const [createFolderModalOpen, setCreateFolderModalOpen] = createSignal<boolean>(false);

export default function CreateFolderModal() {
	const [appContext, _setAppContext] = useApp();
	const $createNode = useAction(createNode);
	const queryClient = useQueryClient();

	const mutation = createMutation(() => ({
		mutationFn: $createNode,
		onError: (_, __, context) => {
			if (!context) return;
			queryClient.setQueryData(['nodes', context.path], context.previousData);
			toast.error('Failed to create folder', { id: context.toastId });
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
					draft.children.push({
						createdAt: new Date(),
						id: String(formData.get('id')),
						name: String(formData.get('name')),
						parentId: draft.node.id,
						updatedAt: new Date(),
						userId: 'pending'
					});
					draft.children.sort((a, b) => a.name.localeCompare(b.name));
				})
			);
			const toastId = toast.loading(`Creating Folder: ${formData.get('name')}`);
			return { path: appContext.path, previousData, toastId };
		},
		onSettled: (data, __, ___, context) => {
			if (!context) return;
			queryClient.invalidateQueries({ queryKey: ['nodes', context.path] });
			if (!data) return;
			toast.success(`Created Folder: ${data.name}`, { id: context.toastId });
		}
	}));

	return (
		<BaseModal
			open={createFolderModalOpen()}
			setOpen={setCreateFolderModalOpen}
			title="Create Folder"
		>
			{(close) => (
				<form
					action={createNode}
					class="flex flex-col gap-4"
					method="post"
					onSubmit={async (event) => {
						event.preventDefault();
						const form = event.target as HTMLFormElement;
						const idInput = form.querySelector('input[name="id"]') as HTMLInputElement;
						idInput.value = nanoid();
						mutation.mutate(new FormData(form));
					}}
				>
					<input name="parentPath" type="hidden" value={appContext.path} />
					<input name="id" type="hidden" value={nanoid()} />
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
					</TextField>
					<Button class="self-end" onClick={close} type="submit">
						Submit
					</Button>
				</form>
			)}
		</BaseModal>
	);
}
