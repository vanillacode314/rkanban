import { Key } from '@solid-primitives/keyed';
import {
	A,
	createAsync,
	RouteDefinition,
	useAction,
	useLocation,
	useSubmissions
} from '@solidjs/router';
import { createEffect, JSXElement, Show } from 'solid-js';
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
import { createNode, deleteNode, getNodes, isFolder } from '~/db/utils/nodes';
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
	const [appContext, _setAppContext] = useApp();
	const submissions = useSubmissions(createNode);

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
							<div class="flex h-10 overflow-hidden rounded-md border border-input">
								<A
									class="flex h-10 grow items-center justify-start gap-2 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:folder text-lg" />
									<span class="grow">{node().name}</span>
								</A>
								<FolderDropdownMenu node={node()} />
							</div>
						)}
					</Key>
					<Key each={files()} by="id">
						{(node) => (
							<div class="flex h-10 overflow-hidden rounded-md border border-input">
								<A
									class="flex h-10 grow items-center justify-start gap-2 px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									href={path.join(appContext.path, node().name)}
								>
									<span class="i-heroicons:document text-lg" />
									<span class="grow">{node().name}</span>
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
	const [_appContext, setAppContext] = useApp();
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
	const [_appContext, setAppContext] = useApp();
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
