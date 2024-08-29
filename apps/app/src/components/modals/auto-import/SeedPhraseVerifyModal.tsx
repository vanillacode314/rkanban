import { makePersisted } from '@solid-primitives/storage';
import { action, reload, useAction } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import { For, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput } from '~/components/ui/text-field';
import { db } from '~/db';
import { users } from '~/db/schema';
import { getUser, refreshAccessToken } from '~/utils/auth.server';
import {
	decryptDataWithKey,
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	getPasswordKey
} from '~/utils/crypto';
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

		const user = await getUser();
		if (!user) return new Error('Unauthorized');

		await db
			.update(users)
			.set({ encryptedPrivateKey, publicKey, salt })
			.where(eq(users.id, user.id));
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
										const publicKeyString = btoa(
											JSON.stringify(await window.crypto.subtle.exportKey('jwk', publicKey))
										);
										await $enableEncryption(encryptedString, saltString, publicKeyString);
										window.location.reload();
									},
									{
										loading: 'Enabling Encryption...',
										success: 'Encryption Enabled',
										error: 'Error'
									}
								);
							}
						}
					}}
				>
					<p>Write down the pass phrase in the input boxes given to verify it.</p>
					<div class="grid grid-cols-2 grid-rows-8 gap-2 rounded font-mono">
						<For each={Array.from({ length: 16 })}>
							{(_, index) => (
								<TextField>
									<TextFieldInput
										onPaste={(event: ClipboardEvent) => {
											const data = event.clipboardData?.getData('text/plain');
											queueMicrotask(() => {
												const phrases = data?.split(' ');
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
							Cancel Sign Up
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
