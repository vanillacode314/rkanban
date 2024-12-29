import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
	draggable,
	dropTargetForElements,
	monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { createKeyHold } from '@solid-primitives/keyboard';
import { Key } from '@solid-primitives/keyed';
import { resolveElements } from '@solid-primitives/refs';
import { createListTransition } from '@solid-primitives/transition-group';
import { A, RouteDefinition, useAction, useNavigate } from '@solidjs/router';
import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { TNode } from 'db/schema';
import { animate, spring } from 'motion';
import { create } from 'mutative';
import {
	createSignal,
	For,
	JSXElement,
	Match,
	onCleanup,
	onMount,
	ParentComponent,
	Show,
	Switch
} from 'solid-js';
import { unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';

import { useConfirmModal } from '~/components/modals/auto-import/ConfirmModal';
import { setCreateFileModalOpen } from '~/components/modals/auto-import/CreateFileModal';
import { setCreateFolderModalOpen } from '~/components/modals/auto-import/CreateFolderModal';
import { setRenameFileModalOpen } from '~/components/modals/auto-import/RenameFileModal';
import { setRenameFolderModalOpen } from '~/components/modals/auto-import/RenameFolderModal';
import Modal from '~/components/modals/BaseModal';
import PathCrumbs from '~/components/PathCrumbs';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { Skeleton } from '~/components/ui/skeleton';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { copyNode, deleteNode, getNodes, isFolder, updateNode } from '~/db/utils/nodes';
import { cn } from '~/lib/utils';
import * as path from '~/utils/path';
import { createSubscription, makeSubscriptionHandler } from '~/utils/subscribe';
import { assertNotError } from '~/utils/types';

export const route: RouteDefinition = {
	matchFilters: {
		folder: (pathname: string) =>
			!pathname.endsWith('.project') && !RESERVED_PATHS.includes(pathname)
	},
	preload: ({ location }) => {
		const queryClient = useQueryClient();
		queryClient.prefetchQuery({
			queryFn: ({ queryKey }) => getNodes(queryKey[1], { includeChildren: true }),
			queryKey: ['nodes', decodeURIComponent(location.pathname)]
		});
	}
};

export default function FolderPage() {
	const [appContext, _] = useApp();
	const nodesQuery = createQuery(() => ({
		queryFn: ({ queryKey }) => {
			return getNodes(queryKey[1], { includeChildren: true });
		},
		queryKey: ['nodes', appContext.path]
	}));

	const $updateNode = useAction(updateNode);

	const currentNode = () => assertNotError(nodesQuery.data)!.node;
	const children = () => (nodesQuery.data ? assertNotError(nodesQuery.data)!.children : []);
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
		<>
			<HelpOverlay />
			<Switch>
				<Match when={nodesQuery.isPending}>
					<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
						<div class="flex justify-end gap-4">
							<Skeleton height={40} radius={5} width={150} />
							<Skeleton height={40} radius={5} width={150} />
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
						<AnimatedNodesList>
							<For each={Array.from({ length: 4 })}>
								{() => <Skeleton height={40} radius={5} />}
							</For>
						</AnimatedNodesList>
					</div>
				</Match>
				<Match when={nodesQuery.isSuccess}>
					<Show fallback={<FolderNotFound />} when={!(nodesQuery.data instanceof Error)}>
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
				</Match>
			</Switch>
		</>
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
	const [appContext, { addToClipboard, filterClipboard }] = useApp();
	const navigate = useNavigate();
	const shiftKey = createKeyHold('Shift', { preventDefault: false });
	const isSelected = () =>
		appContext.clipboard.some(
			(item) => item.data === props.node.id && item.type === 'id/node' && item.mode === 'selection'
		);

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
			<Show
				fallback={
					<div class="grid size-10 place-content-center">
						<Checkbox
							checked={isSelected()}
							class="space-x-0"
							onChange={(checked) => {
								if (checked)
									addToClipboard({
										data: props.node.id,
										meta: {
											node: props.node,
											path: path.join('/home', appContext.path, props.node.name)
										},
										mode: 'selection',
										type: 'id/node'
									});
								else {
									filterClipboard(
										(item) =>
											!(
												item.data === props.node.id &&
												item.type === 'id/node' &&
												item.mode === 'selection'
											)
									);
								}
							}}
						/>
					</div>
				}
				when={(!shiftKey() && appContext.mode === 'normal') || props.node.name === '..'}
			>
				{props.dropdownMenu}
			</Show>
		</div>
	);
}

function FolderNode(props: { node: TNode }) {
	const [appContext, { addToClipboard, setCurrentNode }] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();
	const queryClient = useQueryClient();

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
								setCurrentNode(props.node);
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
								addToClipboard({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'copy',
									type: 'id/node'
								});
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
								addToClipboard({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'move',
									type: 'id/node'
								});
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
										toast.promise(
											async () => {
												await $deleteNode(formData);
												await queryClient.invalidateQueries({
													queryKey: ['nodes', appContext.path]
												});
											},
											{
												error: 'Error',
												loading: 'Deleting Folder',
												success: 'Deleted Folder'
											}
										);
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
	const [appContext, { addToClipboard, setCurrentNode }] = useApp();
	const $deleteNode = useAction(deleteNode);
	const confirmModal = useConfirmModal();
	const queryClient = useQueryClient();

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
								setCurrentNode(props.node);
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
								if (
									appContext.clipboard.some(
										(item) => item.type === 'id/node' && item.data === props.node.id
									)
								)
									return;
								addToClipboard({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'copy',
									type: 'id/node'
								});
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

								addToClipboard({
									data: props.node.id,
									meta: {
										node: props.node,
										path: path.join('/home', appContext.path, props.node.name)
									},
									mode: 'move',
									type: 'id/node'
								});
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
										toast.promise(
											async () => {
												await $deleteNode(formData);
												await queryClient.invalidateQueries({
													queryKey: ['nodes', appContext.path]
												});
											},
											{
												error: 'Error',
												loading: 'Deleting File',
												success: 'Deleted File'
											}
										);
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
	const [appContext, { addToClipboard, clearClipboard, filterClipboard, setCurrentNode, setMode }] =
		useApp();
	const $updateNode = useAction(updateNode);
	const $copyNode = useAction(copyNode);
	const queryClient = useQueryClient();
	const confirmModal = useConfirmModal();
	const $deleteNode = useAction(deleteNode);

	const nodesInClipboard = () =>
		appContext.clipboard.filter(
			(item) => item.type === 'id/node' && (item.mode === 'move' || item.mode === 'copy')
		);

	const selectedNodes = () =>
		appContext.clipboard.filter((item) => item.mode === 'selection' && item.type === 'id/node');

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
		if (items.length <= 0) return;

		toast.promise(
			async () => {
				await Promise.all(
					items.map((item) => {
						const formData = new FormData();
						formData.set('id', item.data);
						const { node } = item.meta as { node: TNode; path: string };
						formData.set('parentId', props.currentNode.id);
						formData.set('appId', appContext.id);
						switch (item.mode) {
							case 'copy':
								return $copyNode(formData);
							case 'move':
								formData.set('name', node.name);
								return $updateNode(formData);
							default:
								return;
						}
					})
				);
				await queryClient.invalidateQueries({ queryKey: ['nodes', appContext.path] });
				filterClipboard(($item) => !items.some((item) => $item.data === item.data));
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
			<Show when={appContext.mode === 'normal' && nodesInClipboard().length > 0}>
				<Button class="flex items-center gap-2" onClick={paste} variant="secondary">
					<span class="i-heroicons:clipboard text-lg" />
					<span>Paste</span>
				</Button>
			</Show>
			<Show when={appContext.mode === 'normal' && props.nodes.length > 0}>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						setMode('selection');
					}}
					variant="secondary"
				>
					<span class="i-fluent:select-all-24-regular text-lg" />
					<span>Multi Select Mode</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						setCurrentNode(props.currentNode);
						setCreateFileModalOpen(true);
					}}
				>
					<span class="i-heroicons:document-plus text-lg" />
					<span>Create Project</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						setCurrentNode(props.currentNode);
						setCreateFolderModalOpen(true);
					}}
				>
					<span class="i-heroicons:folder-plus text-lg" />
					<span>Create Folder</span>
				</Button>
			</Show>
			<Show when={appContext.mode === 'selection' && selectedNodes().length > 0}>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						filterClipboard((item) => item.mode !== 'selection');
					}}
				>
					<span class="i-fluent:select-all-off-24-regular text-lg" />
					<span>Unselect All</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						filterClipboard((item) => item.mode !== 'selection');
						addToClipboard(
							...props.nodes.map((node) => ({
								data: node.id,
								meta: {
									node,
									path: path.join('/home', appContext.path, node.name)
								},
								mode: 'selection' as const,
								type: 'id/node' as const
							}))
						);
					}}
				>
					<span class="i-fluent:select-all-24-filled text-lg" />
					<span>Select All</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						const $selectedNodes = selectedNodes();
						filterClipboard(
							(item) =>
								item.mode !== 'selection' &&
								!($selectedNodes.some((node) => node.data === item.data) && item.type === 'id/node')
						);
						addToClipboard(
							...$selectedNodes.map(
								create((item) => {
									item.mode = 'copy';
								})
							)
						);
					}}
				>
					<span class="i-heroicons:clipboard text-lg" />
					<span>Copy</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						const $selectedNodes = selectedNodes();
						filterClipboard(
							(item) =>
								item.mode !== 'selection' &&
								!($selectedNodes.some((node) => node.data === item.data) && item.type === 'id/node')
						);
						addToClipboard(
							...$selectedNodes.map(
								create((item) => {
									item.mode = 'move';
								})
							)
						);
					}}
				>
					<span class="i-heroicons:scissors text-lg" />
					<span>Cut</span>
				</Button>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						confirmModal.open({
							message: `Are you sure you want to delete the selected files and folders.`,
							onYes() {
								const formData = new FormData();
								formData.set('appId', appContext.id);
								for (const item of selectedNodes()) {
									formData.append('id', item.data);
								}
								toast.promise(
									async () => {
										await $deleteNode(formData);
										await queryClient.invalidateQueries({
											queryKey: ['nodes', appContext.path]
										});
										clearClipboard();
									},
									{
										error: 'Error',
										loading: 'Deleting Folder',
										success: 'Deleted Folder'
									}
								);
							},
							title: 'Delete Folder'
						});
					}}
					variant="destructive"
				>
					<span class="i-heroicons:trash text-lg" />
					<span>Delete</span>
				</Button>
			</Show>
			<Show when={appContext.mode === 'selection'}>
				<Button
					class="flex items-center gap-2"
					onClick={() => {
						filterClipboard((item) => item.mode !== 'selection');
					}}
				>
					<span class="i-heroicons:check-circle-solid text-lg" />
					<span>Done</span>
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

function HelpOverlay() {
	const [open, setOpen] = createSignal(false);

	return (
		<>
			<Modal id="help-overlay" open={open()} setOpen={setOpen} title="Help">
				{() => (
					<>
						<p>Hold shift to access multi selection mode</p>
					</>
				)}
			</Modal>
			<div class="fixed bottom-4 right-4 opacity-50">
				<button onClick={() => setOpen(true)} type="button">
					<span class="i-heroicons:question-mark-circle text-2xl" />
				</button>
			</div>
		</>
	);
}
