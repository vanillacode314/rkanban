import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements,
	monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Key } from '@solid-primitives/keyed';
import {
	A,
	createAsync,
	revalidate,
	RouteDefinition,
	useAction,
	useSubmissions
} from '@solidjs/router';
import { TNode } from 'db/schema';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { produce, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';

import { useConfirmModal } from '~/components/modals/auto-import/ConfirmModal';
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
import { copyNode, createNode, deleteNode, getNodes, updateNode } from '~/db/utils/nodes';
import { cn } from '~/lib/utils';
import { decryptWithUserKeys } from '~/utils/auth.server';
import * as path from '~/utils/path';
import { createSubscription } from '~/utils/subscribe';
import { assertNotError } from '~/utils/types';

export const route: RouteDefinition = {
	matchFilters: {
		folder: (pathname: string) =>
			!pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	},
	preload: ({ location }) => {
		getNodes(decodeURIComponent(location.pathname), { includeChildren: true });
	}
};

export default function FolderPage() {
	const [appContext, setAppContext] = useApp();
	const serverNodes = createAsync(() => getNodes(appContext.path, { includeChildren: true }));
	const submissions = useSubmissions(createNode);
	const $updateNode = useAction(updateNode);
	const $copyNode = useAction(copyNode);

	const pendingNodes = () =>
		[...submissions.values()]
			.filter((submission) => submission.pending)
			.map((submission) => ({
				createdAt: new Date(),
				id: String(submission.input[0].get('id')),
				isDirectory: String(submission.input[0].get('isDirectory')) === 'true',
				name: String(submission.input[0].get('name')),
				parentId: assertNotError(serverNodes())!.node.id,
				updatedAt: new Date(),
				userId: 'pending'
			}));

	const nodes = () =>
		serverNodes() ? [...assertNotError(serverNodes())!.children, ...pendingNodes()] : [];
	const currentNode = () => assertNotError(serverNodes())!.node;
	const folders = () => nodes()?.filter((node) => node.isDirectory) ?? [];
	const files = () => nodes()?.filter((node) => !node.isDirectory) ?? [];
	const nodesInClipboard = () => appContext.clipboard.filter((item) => item.type === 'id/node');

	const VALID_KEYS = [getNodes.key];
	void createSubscription(async ({ invalidate, message }) => {
		const keys = invalidate.filter((key) => VALID_KEYS.includes(key));
		if (keys.length === 0) return;
		const promises = [] as Promise<void>[];
		for (const key of keys) {
			promises.push(revalidate(key));
		}
		await Promise.all(promises);
		const re = new RegExp(String.raw`encrypted:[^\s]+`);
		const matches = message.match(re);
		let decryptedString: string;
		if (!matches) {
			decryptedString = message;
		} else {
			const decryptedValues = await Promise.all(
				matches.map(async (match) => {
					const data = match.slice('encrypted:'.length);
					return [match, await decryptWithUserKeys(data)];
				})
			);
			decryptedString = message;
			for (const [match, decrypted] of decryptedValues) {
				decryptedString = decryptedString.replace(match, decrypted);
			}
		}
		toast.info(decryptedString);
	});

	function paste() {
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
							formData.set('appId', appContext.id);
							if (item.mode === 'move') formData.set('name', node.name);
							return item.mode === 'move' ? $updateNode(formData) : $copyNode(formData);
						})
					);
					setAppContext('clipboard', ($items) =>
						$items.filter(($item) => !items.some((item) => $item.data === item.data))
					);
				},
				{
					error: 'Paste Failed',
					loading: 'Pasting...',
					success: 'Pasted'
				}
			);
	}

	onMount(() => {
		const cleanup = combine(
			monitorForElements({
				canMonitor({ source }) {
					return source.data.type === 'node';
				},
				onDrop({ location, source }) {
					const destination = location.current.dropTargets[0];
					if (!destination) return;
					if (!(destination.data.type === 'node' && source.data.type === 'node')) return;
					if (typeof destination.data.id !== 'string') return;
					if (typeof source.data.id !== 'string') return;
					const parentId = destination.data.id;
					const formData = new FormData();
					formData.set('id', source.data.id);
					formData.set('parentId', parentId);
					formData.set('appId', appContext.id);
					toast.promise(() => $updateNode(formData), {
						error: 'Error',
						loading: 'Moving...',
						success: 'Moved Successfully'
					});
				}
			})
		);
		onCleanup(cleanup);
	});

	return (
		<Show
			fallback={
				<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
					<div>Folder Not Found</div>
					<Button as={A} href="/">
						Go Home
					</Button>
				</div>
			}
			when={!(serverNodes() instanceof Error)}
		>
			<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
				<div class="flex justify-end gap-4 empty:hidden">
					<Show when={nodesInClipboard().length > 0}>
						<Button class="flex items-center gap-2" onClick={paste} variant="secondary">
							<span class="i-heroicons:clipboard text-lg" />
							<span>Paste</span>
						</Button>
					</Show>
					<Show when={nodes().length > 0}>
						<Button class="flex items-center gap-2" onClick={() => setCreateFileModalOpen(true)}>
							<span class="i-heroicons:document-plus text-lg" />
							<span>Create Project</span>
						</Button>
						<Button class="flex items-center gap-2" onClick={() => setCreateFolderModalOpen(true)}>
							<span class="i-heroicons:folder-plus text-lg" />
							<span>Create Folder</span>
						</Button>
					</Show>
				</div>
				<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
					<Show when={appContext.path === '/'}>
						<Button
							as={A}
							class="flex items-center justify-start gap-2"
							href="/settings"
							variant="outline"
						>
							<span class="i-heroicons:cog text-lg" />
							<span>Settings</span>
						</Button>
					</Show>
				</div>
				<PathCrumbs />
				<Show
					fallback={
						<div class="relative isolate grid h-full place-content-center place-items-center gap-4 font-medium">
							<img
								class="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-5"
								src="/empty.svg"
							/>
							<span>Empty Folder</span>
							<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
								<Button
									class="flex items-center gap-2"
									onClick={() => setCreateFileModalOpen(true)}
								>
									<span class="i-heroicons:document-plus text-lg" />
									<span>Create Project</span>
								</Button>
								OR
								<Button
									class="flex items-center gap-2"
									onClick={() => setCreateFolderModalOpen(true)}
								>
									<span class="i-heroicons:folder-plus text-lg" />
									<span>Create Folder</span>
								</Button>
							</div>
						</div>
					}
					when={nodes().length > 0}
				>
					<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
						<Show when={currentNode().parentId !== null}>
							<FolderNode
								node={{
									createdAt: new Date(),
									id: currentNode().parentId!,
									isDirectory: true,
									name: '..',
									parentId: '__parent__',
									updatedAt: new Date(),
									userId: currentNode().userId
								}}
							/>
						</Show>
						<Key by="id" each={folders()}>
							{(node) => <FolderNode node={node()} />}
						</Key>
						<Key by="id" each={files()}>
							{(node) => <FileNode node={node()} />}
						</Key>
					</div>
				</Show>
			</div>
		</Show>
	);
}

function FolderNode(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();

	let ref!: HTMLDivElement;

	const [dragState, setDragState] = createSignal<'dragging-over' | null>(null);

	onMount(() => {
		const cleanup = combine(
			draggable({
				element: ref,
				getInitialData: () => ({ id: props.node.id, node: props.node, type: 'node' })
			}),
			dropTargetForElements({
				canDrop({ source }) {
					return source.data.type === 'node' && source.data.id !== props.node.id;
				},
				element: ref,
				getData: () => ({ id: props.node.id, type: 'node' }),
				onDragEnter: () => setDragState('dragging-over'),
				onDragLeave: () => setDragState(null),
				onDrop: () => {
					setDragState(null);
				}
			})
		);
		onCleanup(cleanup);
	});

	return (
		<DropdownMenu>
			<DropdownMenuTrigger as={Button<'button'>} class="rounded-none" size="icon" variant="ghost">
				<span class="i-heroicons:ellipsis-vertical text-lg" />
			</DropdownMenuTrigger>
			<DropdownMenuContent class="w-48">
				<DropdownMenuItem
					onSelect={() => {
						setAppContext('currentNode', props.node);
						setRenameFolderModalOpen(true);
					}}
				>
					<span>Rename</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:pencil-solid" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						if (
							appContext.clipboard.some(
								(item) => item.type === 'id/node' && item.data === props.node.id
							)
						)
							return;
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'copy',
									type: 'id/node'
								});
							})
						);
					}}
				>
					<span>Copy</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:document-duplicate" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						if (
							appContext.clipboard.some(
								(item) => item.type === 'id/node' && item.data === props.node.id
							)
						)
							return;
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'move',
									type: 'id/node'
								});
							})
						);
					}}
				>
					<span>Cut</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:scissors" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						confirmModal.open({
							message: `Are you sure you want to delete ${props.node.name}?`,
							onYes() {
								const formData = new FormData();
								formData.set('id', props.node.id);
								formData.set('appId', appContext.id);
								toast.promise(() => $deleteNode(formData), {
									error: 'Error',
									loading: 'Deleting Folder',
									success: 'Deleted Folder'
								});
							},
							title: 'Delete Folder'
						});
					}}
				>
					<span>Delete</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:trash" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function FileNode(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();

	let ref!: HTMLDivElement;

	onMount(() => {
		const cleanup = combine(
			draggable({ element: ref, getInitialData: () => ({ id: props.node.id, type: 'node' }) })
		);
		onCleanup(cleanup);
	});

	return (
		<DropdownMenu>
			<DropdownMenuTrigger as={Button<'button'>} class="rounded-none" size="icon" variant="ghost">
				<span class="i-heroicons:ellipsis-vertical text-lg" />
			</DropdownMenuTrigger>
			<DropdownMenuContent class="w-48">
				<DropdownMenuItem
					onSelect={() => {
						setAppContext('currentNode', props.node);
						setRenameFileModalOpen(true);
					}}
				>
					<span>Rename</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:pencil-solid" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'copy',
									type: 'id/node'
								});
							})
						);
					}}
				>
					<span>Copy</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:document-duplicate" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						setAppContext(
							'clipboard',
							produce((clipboard) => {
								clipboard.push({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'move',
									type: 'id/node'
								});
							})
						);
					}}
				>
					<span>Cut</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:scissors" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => {
						confirmModal.open({
							message: `Are you sure you want to delete ${props.node.name}?`,
							onYes: () => {
								const formData = new FormData();
								formData.set('id', props.node.id);
								formData.set('appId', appContext.id);
								toast.promise(() => $deleteNode(formData), {
									error: 'Error',
									loading: 'Deleting File',
									success: 'Deleted File'
								});
							},
							title: 'Delete File'
						});
					}}
				>
					<span>Delete</span>
					<DropdownMenuShortcut class="text-base">
						<span class="i-heroicons:trash" />
					</DropdownMenuShortcut>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
