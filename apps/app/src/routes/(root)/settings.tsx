import { A, action, createAsync, redirect, RouteDefinition, useAction } from '@solidjs/router';
import { eq, sql } from 'drizzle-orm';
import { Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';

import { useConfirmModal } from '~/components/modals/auto-import/ConfirmModal';
import { useSeedPhraseModal } from '~/components/modals/auto-import/SeedPhraseModal';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { boards, tasks, TBoard, TTask, users } from '~/db/schema';
import { getBoards } from '~/db/utils/boards';
import { getTasks } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import {
	decryptObjectKeys,
	decryptWithUserKeys,
	encryptWithUserKeys,
	getUser,
	verifyPassword
} from '~/utils/auth.server';
import { generateSeedPhrase } from '~/utils/crypto';
import { download, getFileText } from '~/utils/file';
import itertools from '~/utils/itertools';
import { localforage } from '~/utils/localforage';

import {
	diffBoards,
	diffNodes,
	TStrippedBoard,
	TStrippedNode,
	TStrippedTask
} from './settings.utils';

const deleteUser = action(async () => {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;
	await db.delete(users).where(eq(users.id, user.id));
	deleteCookie('accessToken');
	deleteCookie('refreshToken');
	throw redirect('/auth/signup');
}, 'delete-user');

const disableEncryption = action(async (decryptedBoards: TBoard[], decryptedTasks: TTask[]) => {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');
	await db.transaction(async (tx) => {
		await Promise.all([
			tx
				.insert(boards)
				.values(decryptedBoards)
				.onConflictDoUpdate({
					set: { title: sql`excluded.title` },
					target: boards.id
				}),
			tx
				.insert(tasks)
				.values(decryptedTasks)
				.onConflictDoUpdate({
					set: { title: sql`excluded.title` },
					target: tasks.id
				}),
			tx
				.update(users)
				.set({ encryptedPrivateKey: null, publicKey: null, salt: null })
				.where(eq(users.id, user.id))
		]);
	});
	deleteCookie('accessToken');
}, 'disable-encryption');

export const route: RouteDefinition = {
	preload: () => getUser({ redirectOnUnauthenticated: true })
};

type TBackup = {
	boards: TStrippedBoard[];
	nodes: TStrippedNode[];
	tasks: TStrippedTask[];
};

export default function SettingsPage() {
	const user = createAsync(() => getUser({ redirectOnUnauthenticated: true }), {
		deferStream: true
	});
	const encryptionEnabled = () =>
		user()?.encryptedPrivateKey !== null && user()?.publicKey !== null && user()?.salt !== null;
	const confirmModal = useConfirmModal();
	const seedPhraseModal = useSeedPhraseModal();
	const $disableEncryption = useAction(disableEncryption);
	const $deleteUser = useAction(deleteUser);

	async function enableEncryption() {
		const seedPhrase = await generateSeedPhrase();
		seedPhraseModal.open({ seedPhrase });
	}

	async function onBackup() {
		const toastId = toast.loading('Downloading All Data...');
		const response = await fetch('/api/v1/me.json');
		if (!response.ok) {
			toast.error('Failed to download backup, Retry again later', { id: toastId });
			return;
		}
		const data = (await response.json()) as TBackup;
		if (encryptionEnabled()) {
			toast.loading('Decrypting Data...', { id: toastId });
			await Promise.all(
				itertools.chain(
					data.boards.map(async (board) => {
						board.title = await decryptWithUserKeys(board.title);
					}),
					data.tasks.map(async (task) => {
						task.title = await decryptWithUserKeys(task.title);
					})
				)
			);
		}
		toast.success('Backup successful', { id: toastId });
		download(data, `rkanban-${new Date().toISOString()}.backup.json`);
	}

	async function onRestore() {
		const text = await getFileText();
		if (text == null) {
			toast.error('No file selected');
			return;
		}
		let backupData: TBackup;
		try {
			backupData = JSON.parse(text);
		} catch {
			toast.error('Invalid backup file');
			return;
		}
		const toastId = toast.loading('Downloading current data...');
		let response = await fetch('/api/v1/me.json');
		if (!response.ok) {
			toast.error('Failed to download current data', { id: toastId });
			return;
		}
		const currentData = (await response.json()) as TBackup;
		if (encryptionEnabled()) {
			toast.loading('Decrypting Data...', { id: toastId });
			await Promise.all(
				itertools.chain(
					currentData.boards.map(async (board) => {
						board.title = await decryptWithUserKeys(board.title);
					}),
					currentData.tasks.map(async (task) => {
						task.title = await decryptWithUserKeys(task.title);
					})
				)
			);
		}
		const newNodes = diffNodes(backupData.nodes, currentData.nodes);
		for (const node of newNodes.nodes) {
			if (node.parentId === null) continue;
			if (newNodes.changedIdsMap.has(node.parentId)) {
				node.parentId = newNodes.changedIdsMap.get(node.parentId)!;
			}
		}

		const newBoards = diffBoards(backupData.boards, currentData.boards);
		for (const board of newBoards.boards) {
			if (newNodes.changedIdsMap.has(board.nodeId)) {
				board.nodeId = newNodes.changedIdsMap.get(board.nodeId)!;
			}
		}

		const newTasks = backupData.tasks;
		for (const task of newTasks) {
			if (newBoards.changedIdsMap.has(task.boardId)) {
				task.boardId = newBoards.changedIdsMap.get(task.boardId)!;
			}
		}

		if (encryptionEnabled()) {
			toast.loading('Encrypting Data...', { id: toastId });
			await Promise.all(
				itertools.chain(
					newTasks.map(async (task) => {
						task.title = await encryptWithUserKeys(task.title);
					}),
					newBoards.boards.map(async (board) => {
						board.title = await encryptWithUserKeys(board.title);
					})
				)
			);
		}
		response = await fetch('/api/v1/me', {
			body: JSON.stringify({ boards: newBoards.boards, nodes: newNodes.nodes, tasks: newTasks }),
			headers: {
				'Content-Type': 'application/json'
			},
			method: 'POST'
		});
		if (response.ok) {
			toast.success('Restore successful', { id: toastId });
		} else {
			toast.error('Restore failed', { id: toastId });
		}
	}

	async function onDeleteUser() {
		toast.promise(
			async () => {
				const password = prompt('Please enter your password to delete user');
				if (!password) {
					alert('Cannot delete user without password');
					throw new Error('Cannot delete user without password');
				}
				const isPasswordCorrect = await verifyPassword(password);
				if (!isPasswordCorrect) {
					alert('Incorrect password');
					throw new Error('Incorrect password');
				}
				await $deleteUser();
				await localforage.removeMany(['privateKey', 'publicKey', 'salt']);
			},
			{
				error: 'Error',
				loading: 'Deleting User',
				success: 'Deleted User'
			}
		);
	}

	async function onDisableEncryption() {
		toast.promise(
			async () => {
				const password = prompt('Please enter your password to disable encryption');
				if (!password) {
					alert('Cannot disable encryption without password');
					throw new Error('Cannot disable encryption without password');
				}
				const isPasswordCorrect = await verifyPassword(password);
				if (!isPasswordCorrect) {
					alert('Incorrect password');
					throw new Error('Incorrect password');
				}
				const [$boards, $tasks] = await Promise.all([getBoards(null), getTasks()]);
				const [decryptedBoards, decryptedTasks] = await Promise.all([
					decryptObjectKeys($boards, ['title']),
					decryptObjectKeys($tasks, ['title'])
				]);
				await $disableEncryption(decryptedBoards, decryptedTasks);
				await localforage.removeMany(['privateKey', 'publicKey', 'salt']);
			},
			{
				error: 'Error',
				loading: 'Disabling Encryption',
				success: 'Disabled Encryption'
			}
		);
	}

	return (
		<Show when={user()}>
			<div class="flex flex-col items-start gap-4 py-4">
				<header class="flex w-full flex-col gap-1 border-b pb-4">
					<div class="flex items-center gap-4">
						<A class="i-heroicons:arrow-left text-xl" href="/" />
						<h3 class="text-2xl font-bold">Settings</h3>
					</div>
					<p class="text-muted-foreground">Manage your settings</p>
				</header>
				<h3 class="text-lg font-medium">Data</h3>
				<div class="flex gap-4">
					<Button onClick={() => onBackup()} variant="secondary">
						Download Backup
					</Button>
					<Button
						onClick={() => onRestore().catch(() => toast.error('Restore failed'))}
						variant="secondary"
					>
						Restore Backup
					</Button>
					<Button
						class="flex items-center gap-2"
						onClick={async () => {
							if (encryptionEnabled()) {
								confirmModal.open({
									message: 'Are you sure you want to disable encryption?',
									onYes: onDisableEncryption,
									title: 'Disable Encryption'
								});
							} else {
								enableEncryption();
							}
						}}
						variant="secondary"
					>
						<span
							class={cn(
								'text-xl',
								encryptionEnabled() ? 'i-heroicons:lock-closed' : 'i-heroicons:lock-open'
							)}
						/>
						<span>{encryptionEnabled() ? 'Disable Encryption' : 'Enable Encryption'}</span>
					</Button>
				</div>
				<h3 class="text-lg font-medium">Danger Zone</h3>
				<div class="flex gap-4">
					<form
						action={deleteUser}
						method="post"
						onSubmit={(e) => {
							e.preventDefault();
							confirmModal.open({
								message: 'Are you sure you want to delete your account?',
								onYes: onDeleteUser,
								title: 'Delete User'
							});
						}}
					>
						<Button type="submit" variant="destructive">
							Delete User
						</Button>
					</form>
				</div>
			</div>
		</Show>
	);
}
