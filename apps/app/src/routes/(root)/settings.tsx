import { A, RouteDefinition, action, createAsync, redirect, useAction } from '@solidjs/router';
import { eq, sql } from 'drizzle-orm';
import { Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';
import { useConfirmModal } from '~/components/modals/auto-import/ConfirmModal';
import { useSeedPhraseModal } from '~/components/modals/auto-import/SeedPhraseModal';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { TBoard, TTask, boards, tasks, users } from '~/db/schema';
import { getBoards } from '~/db/utils/boards';
import { getTasks } from '~/db/utils/tasks';
import { cn } from '~/lib/utils';
import { decryptObjectKeys, getUser, verifyPassword } from '~/utils/auth.server';
import { generateSeedPhrase } from '~/utils/crypto';
import { idb } from '~/utils/idb';

const deleteUser = action(async () => {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');
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
					target: boards.id,
					set: { title: sql`excluded.title` }
				}),
			tx
				.insert(tasks)
				.values(decryptedTasks)
				.onConflictDoUpdate({
					target: tasks.id,
					set: { title: sql`excluded.title` }
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
	preload: () => getUser()
};

export default function SettingsPage() {
	const user = createAsync(() => getUser(), { deferStream: true });
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

	return (
		<Show when={user()}>
			<div class="flex flex-col items-start gap-4 py-4">
				<header class="flex w-full flex-col gap-1 border-b pb-4">
					<div class="flex items-center gap-4">
						<A class="i-heroicons:arrow-left text-xl" href="/"></A>
						<h3 class="text-2xl font-bold">Settings</h3>
					</div>
					<p class="text-muted-foreground">Manage your settings</p>
				</header>
				<div class="flex gap-4">
					<form
						action={deleteUser}
						method="post"
						onSubmit={(e) => {
							e.preventDefault();
							confirmModal.open({
								message: 'Are you sure you want to delete your account?',
								title: 'Delete User',
								onYes: () => {
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
											await $deleteUser();
											await idb.delMany(['privateKey', 'publicKey', 'salt']);
										},
										{
											loading: 'Deleting User',
											success: 'Deleted User',
											error: 'Error'
										}
									);
								}
							});
						}}
					>
						<Button variant="destructive" type="submit">
							Delete User
						</Button>
					</form>
					<Button
						onClick={async () => {
							if (encryptionEnabled()) {
								confirmModal.open({
									message: 'Are you sure you want to disable encryption?',
									title: 'Disable Encryption',
									onYes: () => {
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
												await idb.delMany(['privateKey', 'publicKey', 'salt']);
											},
											{
												loading: 'Disabling Encryption',
												success: 'Disabled Encryption',
												error: 'Error'
											}
										);
									}
								});
							} else {
								enableEncryption();
							}
						}}
						class="flex items-center gap-2"
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
			</div>
		</Show>
	);
}
