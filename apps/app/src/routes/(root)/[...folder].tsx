import { Key } from '@solid-primitives/keyed';
import { A, createAsync, RouteDefinition, useAction, useSubmissions } from '@solidjs/router';
import { Show } from 'solid-js';
import { produce, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { setCreateFileModalOpen } from '~/components/modals/auto-import/CreateFileModal';
import { setCreateFolderModalOpen } from '~/components/modals/auto-import/CreateFolderModal';
import { setRenameFileModalOpen } from '~/components/modals/auto-import/RenameFileModal';
import { setRenameFolderModalOpen } from '~/components/modals/auto-import/RenameFolderModal';
import PathCrumbs from '~/components/PathCrumbs';
import { Button } from '~/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { TNode } from '~/db/schema';
import { copyNode, createNode, deleteNode, getNodes, isFolder, updateNode } from '~/db/utils/nodes';
import * as path from '~/utils/path';

export const route: RouteDefinition = {
	preload: ({ location }) => {
		getNodes(decodeURIComponent(location.pathname), { includeChildren: true });
	},
	matchFilters: {
		folder: (pathname: string) =>
			!pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	}
};

export default function Home() {
	const [appContext, _setAppContext] = useApp();
	const serverNodes = createAsync(() => getNodes(appContext.path, { includeChildren: true }));

	return (
		<Show
			when={serverNodes() instanceof Error}
			fallback={<Folder serverNodes={serverNodes() as { node: TNode; children: TNode[] }} />}
		>
			<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
				<div>Folder Not Found</div>
				<Button as={A} href="/">
					Go Home
				</Button>
			</div>
		</Show>
	);
}

function Folder(props: { serverNodes?: { node: TNode; children: TNode[] } }) {
	const [appContext, setAppContext] = useApp();
	const submissions = useSubmissions(createNode);
	const $updateNode = useAction(updateNode);
	const $copyNode = useAction(copyNode);

	const pendingNodes = () =>
		[...submissions.values()]
			.filter((submission) => submission.pending)
			.map((submission) => ({
				id: String(submission.input[0].get('id')),
				name: String(submission.input[0].get('name')) + ' (pending)',
				parentId: props.serverNodes!.node.id,
				createdAt: new Date(),
				updatedAt: new Date(),
				userId: 'pending'
			}));

	const nodes = () =>
		props.serverNodes ? [...props.serverNodes!.children, ...pendingNodes()] : [];
	const currentNode = () => props.serverNodes!.node;
	const folders = () => nodes()?.filter(isFolder) ?? [];
	const files = () => nodes()?.filter((node) => !isFolder(node)) ?? [];
	const nodesInClipboard = () => appContext.clipboard.filter((item) => item.type === 'id/node');

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<div class="flex justify-end gap-4 empty:hidden">
				<Show when={nodesInClipboard().length > 0}>
					<Button
						class="flex items-center gap-2"
						onClick={() => {
							const items = structuredClone(unwrap(nodesInClipboard()));
							for (const [index, item] of items.toReversed().entries()) {
								const { node, path } = item.meta as { node: TNode; path: string };
								if (node.id === currentNode().id && item.mode === 'move') {
									toast.info(`Skipping ${path} because it is the current folder`);
									items.splice(items.length - index - 1, 1);
								} else if (node.parentId === currentNode().id && item.mode === 'move') {
									toast.info(`Skipping ${path} because it is already in the current folder`);
									items.splice(items.length - index - 1, 1);
								}
							}
							if (items.length > 0)
								toast.promise(
									async () => {
										await Promise.all(
											items.map((item) => {
												const formData = new FormData();
												formData.set('id', item.data);
												const { node } = item.meta as { node: TNode; path: string };
												formData.set('parentId', currentNode().id);
												if (item.mode === 'move') formData.set('name', node.name);
												try {
													const x =
														item.mode === 'move' ? $updateNode(formData) : $copyNode(formData);
													return x;
												} catch (error) {
													console.error(error);
												}
											})
										);
										setAppContext('clipboard', ($items) =>
											$items.filter(($item) => !items.some((item) => $item.data === item.data))
										);
									},
									{
										loading: 'Pasting...',
										success: 'Pasted',
										error: 'Paste Failed'
									}
								);
						}}
						variant="secondary"
					>
						<span class="i-heroicons:document-plus text-lg"></span>
						<span>Paste</span>
					</Button>
				</Show>
				<Show when={nodes().length > 0}>
					<Button class="flex items-center gap-2" onClick={() => setCreateFileModalOpen(true)}>
						<span class="i-heroicons:document-plus text-lg"></span>
						<span>Create Project</span>
					</Button>
					<Button class="flex items-center gap-2" onClick={() => setCreateFolderModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Folder</span>
					</Button>
				</Show>
			</div>
			<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
				<Show when={appContext.path === '/'}>
					<Button
						variant="outline"
						class="flex items-center justify-start gap-2"
						as={A}
						href="/settings"
					>
						<span class="i-heroicons:cog text-lg" />
						<span>Settings</span>
					</Button>
				</Show>
			</div>
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
							<div class="grid h-10 grid-cols-[1fr_auto] overflow-hidden rounded-md border border-input">
								<A
									class="grid h-10 grid-cols-[auto_1fr] items-center justify-start gap-2 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:folder text-lg" />
									<span class="truncate">{node().name}</span>
								</A>
								<FolderDropdownMenu node={node()} />
							</div>
						)}
					</Key>
					<Key each={files()} by="id">
						{(node) => (
							<div class="grid h-10 grid-cols-[1fr_auto] overflow-hidden rounded-md border border-input">
								<A
									class="grid h-10 grid-cols-[auto_1fr] items-center justify-start gap-2 overflow-hidden px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:document text-lg" />
									<span class="truncate">{node().name}</span>
								</A>
								<FileDropdownMenu node={node()} />
							</div>
						)}
					</Key>
				</div>
			</Show>
		</div>
	);
}

function FolderDropdownMenu(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost" class="rounded-none">
				<span class="i-heroicons:ellipsis-vertical text-lg"></span>
			</DropdownMenuTrigger>
			<DropdownMenuContent class="w-48">
				<DropdownMenuItem
					onClick={() => {
						setAppContext('currentNode', props.node);
						setRenameFolderModalOpen(true);
					}}
				>
					<span>Rename</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:pencil-solid"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									mode: 'copy',
									type: 'id/node',
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									}
								});
							})
						);
					}}
				>
					<span>Copy</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:clipboard"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									mode: 'move',
									type: 'id/node',
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									}
								});
							})
						);
					}}
				>
					<span>Cut</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:scissors"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
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
					<DropdownMenuShortcut>
						<span class="i-heroicons:trash"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function FileDropdownMenu(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost" class="rounded-none">
				<span class="i-heroicons:ellipsis-vertical text-lg"></span>
			</DropdownMenuTrigger>
			<DropdownMenuContent class="w-48">
				<DropdownMenuItem
					onClick={() => {
						setAppContext('currentNode', props.node);
						setRenameFileModalOpen(true);
					}}
				>
					<span>Rename</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:pencil-solid"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									mode: 'copy',
									type: 'id/node',
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									}
								});
							})
						);
					}}
				>
					<span>Copy</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:clipboard"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									mode: 'move',
									type: 'id/node',
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									}
								});
							})
						);
					}}
				>
					<span>Cut</span>
					<DropdownMenuShortcut>
						<span class="i-heroicons:scissors"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
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
					<DropdownMenuShortcut>
						<span class="i-heroicons:trash"></span>
					</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
