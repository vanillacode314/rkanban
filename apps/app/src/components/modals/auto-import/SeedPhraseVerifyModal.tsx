import { makePersisted } from '@solid-primitives/storage';
import { action, useAction } from '@solidjs/router';
import { eq, sql } from 'drizzle-orm';
import { For, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput } from '~/components/ui/text-field';
import { db } from '~/db';
import { boards, nodes, tasks, users } from '~/db/schema';
import { getUser } from '~/utils/auth.server';
import {
	decryptDataWithKey,
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	exportKey,
	getPasswordKey,
	importKey
} from '~/utils/crypto';
import { idb } from '~/utils/idb';
import { useSeedPhraseModal } from './SeedPhraseModal';

type TSeedPhraseState = {
	seedPhrase: string;
};
const [seedPhraseVerifyModalState, setSeedPhraseVerifyModalState] = createStore<TSeedPhraseState>({
	seedPhrase: ''
});

export function useSeedPhraseVerifyModal() {
	return {
		open: ({ seedPhrase = '' } = {}) =>
			setSeedPhraseVerifyModalState({
				seedPhrase
			}),
		close: () =>
			setSeedPhraseVerifyModalState({
				seedPhrase: ''
			})
	};
}

const enableEncryption = action(
	async (encryptedPrivateKey: string, salt: string, publicKey: string) => {
		'use server';

		let user = await getUser();
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

export function SeedPhrase() {
	const seedPhraseVerifyModal = useSeedPhraseVerifyModal();
	const seedPhraseModal = useSeedPhraseModal();
	const [inputs, setInputs] = createStore<string[]>([]);
	const [seedPhraseVerified, setSeedPhraseVerified] = makePersisted(createSignal<boolean>(false), {
		name: 'seed-phrase-verified'
	});
	setSeedPhraseVerified(false);
	const $enableEncryption = useAction(enableEncryption);

	return (
		<BaseModal
			title="Seed Phrase"
			closeOnOutsideClick={false}
			open={!!seedPhraseVerifyModalState.seedPhrase}
			setOpen={(value) =>
				setSeedPhraseVerifyModalState('seedPhrase', (seedPhrase) => (value ? seedPhrase : ''))
			}
		>
			{(close) => (
				<form
					class="mx-auto flex max-w-sm flex-col gap-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const testString = 'super-duper-secret';
						let encryptedString: string;
						const salt = window.crypto.getRandomValues(new Uint8Array(16));
						{
							const derivationKey = await getPasswordKey(seedPhraseVerifyModalState.seedPhrase);
							const publicKey = await deriveKey(derivationKey, salt, ['encrypt']);
							encryptedString = await encryptDataWithKey(testString, publicKey);
						}
						{
							const derivationKey = await getPasswordKey(inputs.join(' '));
							const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
							const decryptedString = await decryptDataWithKey(encryptedString, privateKey);
							setSeedPhraseVerified(decryptedString === testString);
							if (decryptedString !== testString) {
								toast.error('Verification failed');
								alert('Invalid seed phrase');
							} else {
								seedPhraseVerifyModal.close();
								seedPhraseModal.close();
								toast.promise(
									async () => {
										const derivationKey = await getPasswordKey(
											seedPhraseVerifyModalState.seedPhrase
										);
										const salt = window.crypto.getRandomValues(new Uint8Array(16));
										const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
										const publicKey = await deriveKey(derivationKey, salt, ['encrypt']);
										const password = 'test';
										const derivationKey2 = await getPasswordKey(password);
										const publicKey2 = await deriveKey(derivationKey2, salt, ['encrypt']);
										const encryptedPrivateKey = await encryptKey(privateKey, publicKey2);
										const saltString = btoa(salt.toString());
										const publicKeyString = btoa(await exportKey(publicKey));
										await $enableEncryption(encryptedPrivateKey, saltString, publicKeyString);
										try {
											await idb.setMany([
												['privateKey', await exportKey(privateKey)],
												['salt', salt],
												['publicKey', await exportKey(publicKey)]
											]);
										} catch (e) {
											console.error(e);
										}
									},
									{
										loading: 'Enabling Encryption...',
										success: 'Encryption Enabled',
										error: null
									}
								);
							}
						}
					}}
				>
					<p>Paste or write down the pass phrase in the input boxes given to verify it.</p>
					<div class="flex items-center justify-end gap-2">
						<Button
							onClick={async () => {
								const clipText = await navigator.clipboard.readText();
								const phrases = clipText
									.trim()
									.split(' ')
									.map((s) => s.trim());
								if (phrases.length !== 16) {
									alert('Invalid seed phrase in clipboard');
									return;
								}
								setInputs(phrases);
							}}
							class="flex items-center gap-2"
							variant="ghost"
							size="sm"
						>
							<span class="i-heroicons:clipboard"></span>
							<span>Paste</span>
						</Button>
					</div>
					<div class="font-mono grid grid-cols-2 grid-rows-8 gap-2 rounded">
						<For each={Array.from({ length: 16 })}>
							{(_, index) => (
								<TextField>
									<TextFieldInput
										onPaste={(event: ClipboardEvent) => {
											const data = event.clipboardData?.getData('text/plain');
											setTimeout(() => {
												const phrases = data
													?.trim()
													.split(' ')
													.map((s) => s.trim());
												if (phrases) setInputs(phrases);
											});
										}}
										type="text"
										value={inputs[index()]}
										onInput={(e) => setInputs(index(), e.currentTarget.value)}
									/>
								</TextField>
							)}
						</For>
					</div>
					<div class="flex justify-end gap-4">
						<Button
							variant="outline"
							onClick={() => {
								seedPhraseModal.close();
								seedPhraseVerifyModal.close();
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
	);
}

export default SeedPhrase;
