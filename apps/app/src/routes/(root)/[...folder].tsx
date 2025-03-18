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
import { A, RouteDefinition, useNavigate } from '@solidjs/router';
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

import { Fab, TAction } from '~/components/Fab';
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
import { cn } from '~/lib/utils';
import { useNode, useNodes, useNodesByPath } from '~/queries/nodes';
import { FetchError } from '~/utils/fetchers';
import * as path from '~/utils/path';

export const route: RouteDefinition = {
	matchFilters: {
		folder: (pathname: string) => {
			if (RESERVED_PATHS.includes(`/${pathname}`)) return false;
			if (pathname.endsWith('.project')) return false;
			return true;
		}
	}
};

export default function FolderPage() {
	const [appContext, { setCurrentNode, addToClipboard, clearClipboard, filterClipboard, setMode }] =
		useApp();

	const [nodes] = useNodesByPath(() => ({ includeChildren: true, path: appContext.path }));
	const [, { deleteNodes, updateNode }] = useNodes(() => ({ enabled: false }));

	const currentNode = () => nodes.data![0];
	const children = () => nodes.data?.slice(1) ?? [];
	const folders = () => children().filter((node) => !node.name.endsWith('.project'));
	const files = () => children().filter((node) => node.name.endsWith('.project'));

	const confirmModal = useConfirmModal();

	const nodesInClipboard = () =>
		appContext.clipboard.filter(
			(item) => item.type === 'id/node' && (item.mode === 'move' || item.mode === 'copy')
		);

	const selectedNodes = () =>
		appContext.clipboard.filter((item) => item.mode === 'selection' && item.type === 'id/node');

	const actions = (): TAction[] => {
		if (appContext.mode === 'normal' && nodesInClipboard().length > 0) {
			return [
				{
					handler: paste,
					icon: 'i-heroicons:clipboard',
					label: 'Paste'
				},
				{
					handler: clearClipboard,
					icon: 'i-heroicons:x-circle',
					label: 'Clear',
					variant: 'secondary'
				}
			];
		}
		if (appContext.mode === 'selection' && selectedNodes().length > 0) {
			return [
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
					},
					icon: 'i-fluent:select-all-off-24-regular',
					label: 'Unselect All',
					variant: 'secondary'
				},
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
						addToClipboard(
							...children().map((node) => ({
								data: node.id,
								meta: {
									node,
									path: path.join('/home', appContext.path, node.name)
								},
								mode: 'selection' as const,
								type: 'id/node' as const
							}))
						);
					},
					icon: 'i-fluent:select-all-24-filled',
					label: 'Select All',
					variant: 'secondary'
				},
				{
					handler: () => {
						const $selectedNodes = selectedNodes();
						filterClipboard(
							(item) =>
								item.mode !== 'selection' &&
								!($selectedNodes.some((node) => node.data === item.data) && item.type === 'id/node')
						);
						setMode('normal');
						addToClipboard(
							...$selectedNodes.map(
								create((item) => {
									item.mode = 'move';
								})
							)
						);
					},
					icon: 'i-heroicons:scissors',
					label: 'Cut'
				},
				{
					handler: () => {
						const $selectedNodes = selectedNodes();
						confirmModal.open({
							message: `Are you sure you want to delete the selected files and folders.`,
							onYes: () =>
								deleteNodes
									.mutateAsync($selectedNodes.map((item) => item.data))
									.then(() => clearClipboard())
									.catch(async (error) => {
										if (error instanceof FetchError) {
											const data = await error.response.json();
											if (data.message) {
												toast.error(data.message);
												return;
											}
										}
										toast.error('Something went wrong');
									}),
							title: 'Delete Selected Files and Folders'
						});
					},
					icon: 'i-heroicons:trash',
					label: 'Delete',
					variant: 'destructive'
				},
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
						setMode('normal');
					},
					icon: 'i-heroicons:check-circle-solid',
					label: 'Done'
				}
			];
		}
		if (appContext.mode === 'selection') {
			return [
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
					},
					icon: 'i-fluent:select-all-off-24-regular',
					label: 'Unselect All',
					variant: 'secondary'
				},
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
						addToClipboard(
							...children().map((node) => ({
								data: node.id,
								meta: {
									node,
									path: path.join('/home', appContext.path, node.name)
								},
								mode: 'selection' as const,
								type: 'id/node' as const
							}))
						);
					},
					icon: 'i-fluent:select-all-24-filled',
					label: 'Select All',
					variant: 'secondary'
				},
				{
					handler: () => {
						filterClipboard((item) => item.mode !== 'selection');
						setMode('normal');
					},
					icon: 'i-heroicons:check-circle-solid',
					label: 'Done'
				}
			];
		}
		return [
			{
				handler: () => {
					setMode('selection');
				},
				icon: 'i-fluent:select-all-24-regular',
				label: 'Mutli Select Mode',
				variant: 'secondary'
			},
			{
				handler: (event) => {
					setCurrentNode(currentNode());
					if (event && event.currentTarget instanceof HTMLElement) {
						setCreateFileModalOpen(true, event.currentTarget);
						return;
					}
					setCreateFileModalOpen(true);
				},
				icon: 'i-heroicons:document-plus',
				label: 'Create Project'
			},
			{
				handler: (event) => {
					setCurrentNode(currentNode());
					if (event && event.currentTarget instanceof HTMLElement) {
						setCreateFolderModalOpen(true, event.currentTarget);
						return;
					}
					setCreateFolderModalOpen(true);
				},
				icon: 'i-heroicons:folder-plus',
				label: 'Create Folder'
			}
		];
	};

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
		if (items.length <= 0) return;

		toast.promise(
			async () => {
				await Promise.all(
					items.map((item) => {
						switch (item.mode) {
							case 'move':
								return updateNode.mutateAsync({
									id: item.data,
									data: { parentId: currentNode().id }
								});
							default:
								return Promise.resolve();
						}
					})
				);
				filterClipboard(($item) => !items.some((item) => $item.data === item.data));
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

					toast.promise(
						() =>
							updateNode.mutateAsync({
								id: source.data.id as string,
								data: { parentId: destination.data.id as string }
							}),
						{
							error: 'Error',
							loading: 'Moving...',
							success: 'Moved Successfully'
						}
					);
				}
			})
		);
		onCleanup(cleanup);
	});

	return (
		<>
			<HelpOverlay />
			<Switch fallback={<FolderNotFound />}>
				<Match when={nodes.isSuccess}>
					<Fab actions={actions()} />
					<div class="flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden py-4">
						<Toolbar actions={actions()} currentNode={currentNode()!} nodes={children()} />
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
							fallback={<EmptyFolder currentNode={currentNode()} />}
							when={children().length > 0}
						>
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
				</Match>
				<Match when={nodes.isPending}>
					<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
						<div class="hidden justify-end gap-4 md:flex">
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

	const selectionMode = () => shiftKey() || appContext.mode === 'selection';

	return (
		<div
			class={cn(
				'relative grid h-10 grid-cols-[1fr_auto] overflow-hidden rounded-md border',
				props.class
			)}
			ref={props.ref}
		>
			<Show when={selectionMode()}>
				<label
					class="absolute inset-0 z-10 bg-transparent"
					for={`select-${props.node.id}-input`}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						if (props.node.name === '..') return;

						if (!isSelected()) {
							addToClipboard({
								data: props.node.id,
								meta: {
									node: props.node,
									path: path.join('/home', appContext.path, props.node.name)
								},
								mode: 'selection',
								type: 'id/node'
							});
							return;
						}

						filterClipboard(
							(item) =>
								!(
									item.data === props.node.id &&
									item.type === 'id/node' &&
									item.mode === 'selection'
								)
						);
					}}
				/>
			</Show>
			<div class="grid grid-cols-[auto_1fr] text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
				{/* NOTE: Not using anchor to make sure we control the drag behaviour */}
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
							id={`select-${props.node.id}`}
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
				when={!selectionMode() || props.node.name === '..'}
			>
				<Show when={props.node.name !== '..'}>{props.dropdownMenu}</Show>
			</Show>
		</div>
	);
}

function FolderNode(props: { node: TNode }) {
	const [appContext, { addToClipboard, setCurrentNode }] = useApp();
	const [_, { deleteNode }] = useNode(() => ({ id: props.node.id, enabled: false }));
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
			class={cn('group', dragState() === 'dragging-over' ? 'border-blue-300' : '')}
			dragHandleRef={dragHandleRef}
			dropdownMenu={
				<DropdownMenu>
					<DropdownMenuTrigger
						as={Button<'button'>}
						class="rounded-none can-hover:invisible group-hover:can-hover:visible"
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
									onYes: () =>
										deleteNode.mutateAsync().catch(async (error) => {
											if (error instanceof FetchError) {
												const data = await error.response.json();
												if (data.message) {
													toast.error(data.message);
													return;
												}
											}
											toast.error('Something went wrong');
										}),
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
	const [_, { deleteNode }] = useNode(() => ({ id: props.node.id, enabled: false }));
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
			class="group"
			dragHandleRef={dragHandleRef}
			dropdownMenu={
				<DropdownMenu>
					<DropdownMenuTrigger
						as={Button<'button'>}
						class="rounded-none can-hover:invisible group-hover:can-hover:visible"
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
									onYes: () =>
										deleteNode.mutateAsync().catch(async (error) => {
											if (error instanceof FetchError) {
												const data = await error.response.json();
												if (data.message) {
													toast.error(data.message);
													return;
												}
											}
											toast.error('Something went wrong');
										}),
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

function EmptyFolder(props: { currentNode: TNode }) {
	const [, { setCurrentNode }] = useApp();

	return (
		<div class="relative isolate grid h-full place-content-center place-items-center gap-4 font-medium">
			<img class="pointer-events-none absolute -z-10 h-full w-full object-contain opacity-5" src="/empty.svg" />
			<span>Empty Folder</span>
			<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
				<Button
					class="flex items-center gap-2"
					onClick={(event) => {
						setCurrentNode(props.currentNode);
						setCreateFileModalOpen(true, event.currentTarget);
					}}
				>
					<span class="i-heroicons:document-plus text-lg" />
					<span>Create Project</span>
				</Button>
				OR
				<Button
					class="flex items-center gap-2"
					onClick={(event) => {
						setCurrentNode(props.currentNode);
						setCreateFolderModalOpen(true, event.currentTarget);
					}}
				>
					<span class="i-heroicons:folder-plus text-lg" />
					<span>Create Folder</span>
				</Button>
			</div>
		</div>
	);
}

function Toolbar(props: { actions: TAction[]; currentNode: TNode; nodes: TNode[] }) {
	return (
		<div class="hidden justify-end gap-4 empty:hidden md:flex">
			<For each={props.actions}>
				{(action) => (
					<Button
						class="flex items-center gap-2"
						onClick={() => action.handler()}
						type="button"
						variant={action.variant}
					>
						<span class={cn(action.icon, 'text-lg')} />
						<span>{action.label}</span>
					</Button>
				)}
			</For>
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

	const transition = createListTransition(resolved.toArray, {
		onChange({ added, finishRemoved, removed, unchanged }) {
			finishRemoved(removed);
			if (added.length === 0 && removed.length === 0) return;
			for (const el of unchanged) {
				const { left: left1, top: top1 } = el.getBoundingClientRect();
				if (!el.isConnected) return;
				queueMicrotask(() => {
					const { left: left2, top: top2 } = el.getBoundingClientRect();
					animate(
						el,
						{ x: [left1 - left2, 0], y: [top1 - top2, 0] },
						{ damping: 20, stiffness: 150, type: spring }
					);
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
			<div class="fixed bottom-4 right-4 hidden opacity-50 md:block">
				<button onClick={() => setOpen(true)} type="button">
					<span class="i-heroicons:question-mark-circle text-2xl" />
				</button>
			</div>
		</>
	);
}
