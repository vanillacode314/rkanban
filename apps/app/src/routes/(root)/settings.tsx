import { A } from '@solidjs/router';
import { toast } from 'solid-sonner';

import { Button } from '~/components/ui/button';
import { download, getFileText } from '~/utils/file';

import {
	diffBoards,
	diffNodes,
	TStrippedBoard,
	TStrippedNode,
	TStrippedTask
} from './settings.utils';

type TBackup = {
	boards: TStrippedBoard[];
	nodes: TStrippedNode[];
	tasks: TStrippedTask[];
};

export default function SettingsPage() {
	async function onBackup() {
		const toastId = toast.loading('Downloading All Data...');
		const response = await fetch('/api/v1/private/me.json');
		if (!response.ok) {
			toast.error('Failed to download backup, Retry again later', { id: toastId });
			return;
		}
		const data = (await response.json()) as TBackup;
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
		let response = await fetch('/api/v1/private/me.json');
		if (!response.ok) {
			toast.error('Failed to download current data', { id: toastId });
			return;
		}
		const currentData = (await response.json()) as TBackup;
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

		response = await fetch('/api/v1/private/me', {
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

	return (
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
					onClick={() =>
						onRestore().catch((error) => {
							console.error(error);
							toast.error('Restore failed');
						})
					}
					variant="secondary"
				>
					Restore Backup
				</Button>
			</div>
			{/* <h3 class="text-lg font-medium">Danger Zone</h3> */}
		</div>
	);
}
