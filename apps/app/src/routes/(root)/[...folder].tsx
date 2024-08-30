import { Key } from '@solid-primitives/keyed';
import { A, createAsync, useAction, useLocation, useSubmissions } from '@solidjs/router';
import { JSXElement, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { setCreateFileModalOpen } from '~/components/modals/auto-import/CreateFileModal';
import { setCreateFolderModalOpen } from '~/components/modals/auto-import/CreateFolderModal';
import { setRenameFileModalOpen } from '~/components/modals/auto-import/RenameFileModal';
import { setRenameFolderModalOpen } from '~/components/modals/auto-import/RenameFolderModal';
import PathCrumbs from '~/components/PathCrumbs';
import { Button } from '~/components/ui/button';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuShortcut,
	ContextMenuTrigger
} from '~/components/ui/context-menu';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TNode } from '~/db/schema';
import { createNode, deleteNode, getNodes, isFolder } from '~/db/utils/nodes';
import * as path from '~/utils/path';

export const route = {
	preload: () => {
		const location = useLocation();
		getNodes(decodeURIComponent(location.pathname), { includeChildren: true });
	},
	matchFilters: {
		folder: (value: string) => !value.endsWith('.project') && !RESERVED_PATHS.includes(value)
	}
};

export default function Home() {
	const [appContext, _setAppContext] = useApp();
	const serverNodes = createAsync(() => getNodes(appContext.path, { includeChildren: true }));
	const submissions = useSubmissions(createNode);

	const pendingNodes = () =>
		[...submissions.values()]
			.filter((submission) => submission.pending)
			.map((submission) => ({
				id: String(submission.input[0].get('id')),
				name: String(submission.input[0].get('name')) + ' (pending)',
				parentId: serverNodes()!.node.id,
				createdAt: new Date(),
				updatedAt: new Date(),
				userId: 'pending'
			}));

	const nodes = () => (serverNodes() ? [...serverNodes()!.children, ...pendingNodes()] : []);
	const currentNode = () => serverNodes()!.node;
	const folders = () => nodes()?.filter(isFolder) ?? [];
	const files = () => nodes()?.filter((node) => !isFolder(node)) ?? [];

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<Show when={nodes().length > 0}>
				<div class="flex justify-end gap-4">
					<Button class="flex items-center gap-2" onClick={() => setCreateFileModalOpen(true)}>
						<span class="i-heroicons:document-plus text-lg"></span>
						<span>Create Project</span>
					</Button>
					<Button class="flex items-center gap-2" onClick={() => setCreateFolderModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Folder</span>
					</Button>
				</div>
			</Show>
			<PathCrumbs />
			<Show
				when={nodes().length > 0}
				fallback={
					<div class="grid h-full place-content-center place-items-center gap-4 font-medium">
						<span>Empty Folder</span>
						<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
							<Button class="flex items-center gap-2" onClick={() => setCreateFileModalOpen(true)}>
								<span class="i-heroicons:document-plus text-lg"></span>
								<span>Create Project</span>
							</Button>
							OR
							<Button
								class="flex items-center gap-2"
								onClick={() => setCreateFolderModalOpen(true)}
							>
								<span class="i-heroicons:plus text-lg"></span>
								<span>Create Folder</span>
							</Button>
						</div>
					</div>
				}
			>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
					<Show when={currentNode().parentId !== null}>
						<Button
							variant="outline"
							class="flex items-center justify-start gap-2"
							as={A}
							href={path.join(appContext.path, '..')}
						>
							<span class="i-heroicons:folder text-lg" />
							<span>..</span>
						</Button>
					</Show>
					<Key each={folders()} by="id">
						{(node) => (
							<FolderContextMenu node={node()}>
								<Button
									variant="outline"
									class="flex items-center justify-start gap-2"
									as={A}
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:folder text-lg" />
									<span>{node().name}</span>
								</Button>
							</FolderContextMenu>
						)}
					</Key>
					<Key each={files()} by="id">
						{(node) => (
							<FileContextMenu node={node()}>
								<Button
									variant="outline"
									class="flex items-center justify-start gap-2"
									as={A}
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:document text-lg" />
									<span>{node().name}</span>
								</Button>
							</FileContextMenu>
						)}
					</Key>
				</div>
			</Show>
		</div>
	);
}

function FolderContextMenu(props: { children: JSXElement; node: TNode }) {
	const [_appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);

	return (
		<ContextMenu>
			<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent class="w-48">
					<ContextMenuItem
						onClick={() => {
							setAppContext('currentNode', props.node);
							setRenameFolderModalOpen(true);
						}}
					>
						<span>Rename</span>
						<ContextMenuShortcut>
							<span class="i-heroicons:pencil-solid"></span>
						</ContextMenuShortcut>
					</ContextMenuItem>
					<ContextMenuItem
						onClick={() => {
							const formData = new FormData();
							formData.set('id', props.node.id);
							toast.promise(() => $deleteNode(formData), {
								loading: 'Deleting Folder',
								success: 'Deleted Folder',
								error: 'Error'
							});
						}}
					>
						<span>Delete</span>
						<ContextMenuShortcut>
							<span class="i-heroicons:trash"></span>
						</ContextMenuShortcut>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenu>
	);
}

function FileContextMenu(props: { children: JSXElement; node: TNode }) {
	const [_appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);

	return (
		<ContextMenu>
			<ContextMenuTrigger>{props.children}</ContextMenuTrigger>
			<ContextMenuPortal>
				<ContextMenuContent class="w-48">
					<ContextMenuItem
						onClick={() => {
							setAppContext('currentNode', props.node);
							setRenameFileModalOpen(true);
						}}
					>
						<span>Rename</span>
						<ContextMenuShortcut>
							<span class="i-heroicons:pencil-solid"></span>
						</ContextMenuShortcut>
					</ContextMenuItem>
					<ContextMenuItem
						onClick={() => {
							const formData = new FormData();
							formData.set('id', props.node.id);
							toast.promise(() => $deleteNode(formData), {
								loading: 'Deleting File',
								success: 'Deleted File',
								error: 'Error'
							});
						}}
					>
						<span>Delete</span>
						<ContextMenuShortcut>
							<span class="i-heroicons:trash"></span>
						</ContextMenuShortcut>
					</ContextMenuItem>
				</ContextMenuContent>
			</ContextMenuPortal>
		</ContextMenu>
	);
}
