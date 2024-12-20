import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements,
	monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Key } from '@solid-primitives/keyed';
import { createWritableMemo } from '@solid-primitives/memo';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, createAsync, RouteDefinition, useAction, useNavigate } from '@solidjs/router';
import { TNode } from 'db/schema';
import { produce } from 'immer';
import { animate, spring } from 'motion';
import { createSignal, JSXElement, onCleanup, onMount, ParentComponent, Show } from 'solid-js';
import { unwrap } from 'solid-js/store';
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
import { copyNode, createNode, deleteNode, getNodes, updateNode, isFolder } from '~/db/utils/nodes';
import { cn } from '~/lib/utils';
import { onSubmission } from '~/utils/action';
import * as path from '~/utils/path';
import { createSubscription, makeSubscriptionHandler } from '~/utils/subscribe';
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
	const [appContext, _setAppContext] = useApp();

	const $nodes = createAsync(() => getNodes(appContext.path, { includeChildren: true }));
	const $updateNode = useAction(updateNode);

	const [nodes, setNodes] = createWritableMemo(() => $nodes.latest);

	onSubmission(
		createNode,
		{
			onPending(input) {
				setNodes((nodes) => {
					if (nodes instanceof Error) return nodes;
					return produce(nodes, (nodes) => {
						nodes?.children.push({
							createdAt: new Date(),
							id: String(input[0].get('id')),
							name: String(input[0].get('name')),
							parentId: nodes.node.id,
							updatedAt: new Date(),
							userId: 'pending'
						});
						nodes?.children.sort((a, b) => a.name.localeCompare(b.name));
					});
				});
			}
		},
		{ predicate: (input) => String(input[0].get('parentPath')) === appContext.path }
	);

	const currentNode = () => assertNotError(nodes())!.node;
	const children = () => ($nodes() ? assertNotError(nodes())!.children : []);
	const folders = () => children()?.filter((node) => isFolder(node));
	const files = () => children()?.filter((node) => !isFolder(node));

	void createSubscription(makeSubscriptionHandler([getNodes.key]));

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
		<Show fallback={<FolderNotFound />} when={!($nodes() instanceof Error)}>
			<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
				<Toolbar currentNode={currentNode()} nodes={children()} />
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
				<Show fallback={<EmptyFolder />} when={children().length > 0}>
					<AnimatedNodesList>
						<Show when={currentNode().parentId !== null}>
							<FolderNode
								node={{
									createdAt: new Date(),
									id: currentNode().parentId!,
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
					</AnimatedNodesList>
				</Show>
			</div>
		</Show>
	);
}

function Node(props: {
	class?: string;
	dragHandleRef: HTMLButtonElement;
	dropdownMenu: JSXElement;
	icon: string;
	node: TNode;
	ref: HTMLDivElement;
}) {
	const [appContext, _setAppContext] = useApp();
	const navigate = useNavigate();

	return (
		<div
			class={cn('grid h-10 grid-cols-[1fr_auto] overflow-hidden rounded-md border', props.class)}
			ref={props.ref}
		>
			<div class="grid grid-cols-[auto_1fr] text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
				<button
					class="grid cursor-move place-content-center py-2 pl-4 pr-2"
					data-href={path.join(appContext.path, props.node.name)}
					onClick={(event) => {
						const target = event.currentTarget;
						navigate(target.dataset.href!);
					}}
					ref={props.dragHandleRef}
					role="link"
				>
					<span class={cn('text-lg', props.icon)} />
				</button>
				<A
					class="flex items-center gap-2 overflow-hidden py-2"
					href={path.join(appContext.path, props.node.name)}
				>
					<span
						class={cn(
							'i-heroicons:arrow-path-rounded-square shrink-0 animate-spin',
							props.node.userId === 'pending' ? 'inline-block' : '!hidden'
						)}
					/>
					<span class="truncate">{props.node.name}</span>
				</A>
			</div>
			{props.dropdownMenu}
		</div>
	);
}

function FolderNode(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();

	let ref!: HTMLDivElement;
	let dragHandleRef!: HTMLButtonElement;

	const [dragState, setDragState] = createSignal<'dragging-over' | null>(null);

	onMount(() => {
		const cleanup = combine(
			draggable({
				dragHandle: dragHandleRef,
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
		<Node
			class={dragState() === 'dragging-over' ? 'border-blue-300' : ''}
			dragHandleRef={dragHandleRef}
			dropdownMenu={
				<DropdownMenu>
					<DropdownMenuTrigger
						as={Button<'button'>}
						class="rounded-none"
						size="icon"
						variant="ghost"
					>
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
			}
			icon="i-heroicons:folder"
			node={props.node}
			ref={ref}
		/>
	);
}

function FileNode(props: { node: TNode }) {
	const [appContext, setAppContext] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();

	let ref!: HTMLDivElement;
	let dragHandleRef!: HTMLButtonElement;

	onMount(() => {
		const cleanup = combine(
			draggable({
				dragHandle: dragHandleRef,
				element: ref,
				getInitialData: () => ({ id: props.node.id, type: 'node' })
			})
		);
		onCleanup(cleanup);
	});

	return (
		<Node
			dragHandleRef={dragHandleRef}
			dropdownMenu={
				<DropdownMenu>
					<DropdownMenuTrigger
						as={Button<'button'>}
						class="rounded-none"
						size="icon"
						variant="ghost"
					>
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
			}
			icon="i-heroicons:document"
			node={props.node}
			ref={ref}
		/>
	);
}

function EmptyFolder() {
	return (
		<div class="relative isolate grid h-full place-content-center place-items-center gap-4 font-medium">
			<img
				class="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-5"
				src="/empty.svg"
			/>
			<span>Empty Folder</span>
			<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
				<Button class="flex items-center gap-2" onClick={() => setCreateFileModalOpen(true)}>
					<span class="i-heroicons:document-plus text-lg" />
					<span>Create Project</span>
				</Button>
				OR
				<Button class="flex items-center gap-2" onClick={() => setCreateFolderModalOpen(true)}>
					<span class="i-heroicons:folder-plus text-lg" />
					<span>Create Folder</span>
				</Button>
			</div>
		</div>
	);
}

function Toolbar(props: { currentNode: TNode; nodes: TNode[] }) {
	const [appContext, setAppContext] = useApp();
	const $updateNode = useAction(updateNode);
	const $copyNode = useAction(copyNode);

	const nodesInClipboard = () => appContext.clipboard.filter((item) => item.type === 'id/node');

	function paste() {
		const items = structuredClone(unwrap(nodesInClipboard()));
		for (const [index, item] of items.toReversed().entries()) {
			const { node, path } = item.meta as { node: TNode; path: string };
			if (node.id === props.currentNode.id && item.mode === 'move') {
				toast.info(`Skipping ${path} because it is the current folder`);
				items.splice(items.length - index - 1, 1);
			} else if (node.parentId === props.currentNode.id && item.mode === 'move') {
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
							formData.set('parentId', props.currentNode.id);
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

	return (
		<div class="flex justify-end gap-4 empty:hidden">
			<Show when={nodesInClipboard().length > 0}>
				<Button class="flex items-center gap-2" onClick={paste} variant="secondary">
					<span class="i-heroicons:clipboard text-lg" />
					<span>Paste</span>
				</Button>
			</Show>
			<Show when={props.nodes.length > 0}>
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
	);
}

function FolderNotFound() {
	return (
		<div class="grid h-full w-full place-content-center gap-4 text-lg font-medium">
			<div>Folder Not Found</div>
			<Button as={A} href="/">
				Go Home
			</Button>
		</div>
	);
}

const AnimatedNodesList: ParentComponent = (props) => {
	const resolved = resolveElements(
		() => props.children,
		(el): el is HTMLElement => el instanceof HTMLElement
	);

	const easing = spring({ damping: 20, stiffness: 150 });
	const transition = createListTransition(resolved.toArray, {
		onChange({ added, finishRemoved, removed, unchanged }) {
			finishRemoved(removed);
			if (added.length === 0 && removed.length === 0) return;
			for (const el of unchanged) {
				const { left: left1, top: top1 } = el.getBoundingClientRect();
				if (!el.isConnected) return;
				queueMicrotask(() => {
					const { left: left2, top: top2 } = el.getBoundingClientRect();
					animate(el, { x: [left1 - left2, 0], y: [top1 - top2, 0] }, { easing });
				});
			}
		}
	});

	return (
		<div class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">{transition()}</div>
	);
};
