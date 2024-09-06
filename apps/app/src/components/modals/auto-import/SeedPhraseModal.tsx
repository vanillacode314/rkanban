import { action, useAction } from '@solidjs/router';
import { eq, sql } from 'drizzle-orm';
import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';
import { default as BaseModal } from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { boards, tasks, users } from '~/db/schema';
import { getUser, verifyPassword } from '~/utils/auth.server';
import {
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	exportKey,
	getPasswordKey,
	importKey
} from '~/utils/crypto';
import { idb } from '~/utils/idb';
import { useSeedPhraseVerifyModal } from './SeedPhraseVerifyModal';

type TSeedPhraseState = {
	seedPhrase: string;
};
const [seedPhraseModalState, setSeedPhraseModalState] = createStore<TSeedPhraseState>({
	seedPhrase: ''
});

export function useSeedPhraseModal() {
	return {
		open: ({ seedPhrase }: TSeedPhraseState) =>
			setSeedPhraseModalState({
				seedPhrase
			}),
		close: () =>
			setSeedPhraseModalState({
				seedPhrase: ''
			})
	};
}

export function SeedPhrase() {
	const seedPhraseModal = useSeedPhraseModal();
	const seedPhraseVerifyModal = useSeedPhraseVerifyModal();
	const phrases = () => seedPhraseModalState.seedPhrase.split(' ');
	const $enableEncryption = useAction(enableEncryption);

	return (
		<>
			<BaseModal
				closeOnOutsideClick={false}
				title="Seed Phrase"
				open={!!seedPhraseModalState.seedPhrase}
				setOpen={(value) =>
					setSeedPhraseModalState('seedPhrase', (seedPhrase) => (value ? seedPhrase : ''))
				}
			>
				{() => (
					<form
						class="mx-auto flex max-w-sm flex-col gap-4"
						onSubmit={async (e) => {
							e.preventDefault();
							const testString = 'super-duper-secret';
							const salt = window.crypto.getRandomValues(new Uint8Array(16));
							const derivationKey = await getPasswordKey(seedPhraseModalState.seedPhrase);
							const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
							const publicKey = await deriveKey(derivationKey, salt, ['encrypt']);
							const encryptedString = await encryptDataWithKey(testString, publicKey);
							seedPhraseVerifyModal.open({
								salt,
								encryptedString,
								decryptedString: testString,
								onDismiss: () => seedPhraseModal.close(),
								onVerified: async () => {
									seedPhraseModal.close();
									toast.promise(
										async () => {
											let password = prompt('Enter your password');
											if (!password) {
												alert('You need to enter your password to enable encryption');
												throw new Error('No password');
											}
											const isPasswordCorrect = await verifyPassword(password);
											if (!isPasswordCorrect) {
												alert('Incorrect password');
												throw new Error('Incorrect password');
											}
											const derivationKey2 = await getPasswordKey(password);
											const publicKey2 = await deriveKey(derivationKey2, salt, ['encrypt']);
											const encryptedPrivateKey = await encryptKey(privateKey, publicKey2);
											const saltString = btoa(salt.toString());
											const publicKeyString = btoa(await exportKey(publicKey));
											await $enableEncryption(encryptedPrivateKey, saltString, publicKeyString);
											await idb.setMany([
												['privateKey', await exportKey(privateKey)],
												['salt', salt],
												['publicKey', await exportKey(publicKey)]
											]);
										},
										{
											loading: 'Enabling Encryption...',
											success: 'Encryption Enabled',
											error: null
										}
									);
								}
							});
						}}
					>
						<p>
							Write down your seed phase in a safe place. It will not be shown again.
							<br />
							<br />
							If you forget your password, you can use your seed phrase to access your data and
							reset your password.
							<br />
							<br />
							If you lose your seed phrase and forget your password, you will lose access to all
							your data.
						</p>
						<div class="flex items-center justify-end gap-2">
							<Button
								onClick={() => {
									const a = document.createElement('a');
									a.href = 'data:text/plain;charset=utf-8,' + seedPhraseModalState.seedPhrase;
									const date = new Date();
									const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}h${date.getMinutes()}m${date.getSeconds()}s`;
									a.download = `rkanban-seed-phrase-${dateString}.txt`;
									a.click();
								}}
								class="flex items-center gap-2"
								variant="ghost"
								size="sm"
							>
								<span class="i-heroicons:arrow-down-circle-solid"></span>
								<span>Download</span>
							</Button>
							<Button
								onClick={() => {
									const yes = confirm(
										'Are you sure you want to copy the seed phrase? Other applications on your system can access anything you copy.'
									);
									if (yes) navigator.clipboard.writeText(seedPhraseModalState.seedPhrase);
								}}
								class="flex items-center gap-2"
								variant="ghost"
								size="sm"
							>
								<span class="i-heroicons:clipboard"></span>
								<span>Copy</span>
							</Button>
						</div>
						<div class="font-mono grid select-none grid-cols-[1fr_1fr] grid-rows-8 rounded border p-4">
							<For each={Array.from({ length: 16 }, (_, i) => i + 1)}>
								{(_, index) => <span>{phrases()[index()]}</span>}
							</For>
						</div>
						<div class="flex justify-end gap-4">
							<Button
								variant="outline"
								onClick={() => {
									seedPhraseModal.close();
								}}
							>
								Cancel
							</Button>
							<Button autofocus type="submit">
								Verify
							</Button>
						</div>
					</form>
				)}
			</BaseModal>
		</>
	);
}

const enableEncryption = action(
	async (encryptedPrivateKey: string, salt: string, publicKey: string) => {
		'use server';

		const user = await getUser();
		if (!user) return new Error('Unauthorized');

		await db.transaction(async (tx) => {
			await tx
				.update(users)
				.set({ encryptedPrivateKey, publicKey, salt })
				.where(eq(users.id, user.id))
				.returning();

			const $publicKey = await importKey(atob(publicKey), ['encrypt']);
			const [$boards, $tasks] = await Promise.all([
				tx.select().from(boards).where(eq(boards.userId, user.id)),
				tx.select().from(tasks).where(eq(tasks.userId, user.id))
			]);
			const encryptedBoards = await Promise.all(
				$boards.map(async (board) => {
					board.title = await encryptDataWithKey(board.title, $publicKey);
					return board;
				})
			);

			const encryptedTasks = await Promise.all(
				$tasks.map(async (task) => {
					task.title = await encryptDataWithKey(task.title, $publicKey);
					return task;
				})
			);
			await Promise.all([
				$tasks.length > 0 ?
					tx
						.insert(tasks)
						.values(encryptedTasks)
						.onConflictDoUpdate({
							set: { title: sql`excluded.title` },
							target: tasks.id
						})
				:	Promise.resolve(),

				$boards.length > 0 ?
					tx
						.insert(boards)
						.values(encryptedBoards)
						.onConflictDoUpdate({
							set: { title: sql`excluded.title` },
							target: boards.id
						})
				:	Promise.resolve()
			]);
		});

		deleteCookie('accessToken');
	},
	'enable-encryption'
);

export default SeedPhrase;
