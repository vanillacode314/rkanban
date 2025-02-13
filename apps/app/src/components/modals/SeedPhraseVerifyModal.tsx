import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput } from '~/components/ui/text-field';
import { decryptDataWithKey, deriveKey, getPasswordKey } from '~/utils/crypto';

import BaseModal from './BaseModal';

type TSeedPhraseState = {
	decryptedString: string;
	encryptedString: string;
	onDismiss: () => void;
	onVerified: (seedPhrase: string) => void;
	salt: Uint8Array;
};
const [seedPhraseVerifyModalState, setSeedPhraseVerifyModalState] = createStore<TSeedPhraseState>({
	decryptedString: '',
	encryptedString: '',
	onDismiss: () => {},
	onVerified: () => {},
	salt: new Uint8Array()
});
export function useSeedPhraseVerifyModal() {
	return {
		close: () =>
			setSeedPhraseVerifyModalState({
				decryptedString: '',
				encryptedString: '',
				onDismiss: () => {},
				onVerified: () => {},
				salt: new Uint8Array()
			}),
		open: (state: TSeedPhraseState) => setSeedPhraseVerifyModalState(state)
	};
}

export function SeedPhrase() {
	const seedPhraseVerifyModal = useSeedPhraseVerifyModal();
	const [inputs, setInputs] = createStore<string[]>([]);

	return (
		<BaseModal
			closeOnOutsideClick={false}
			onOpenChange={(value) => {
				if (value) setInputs(Array(16).fill(''));
			}}
			open={seedPhraseVerifyModalState.encryptedString !== ''}
			setOpen={(value) =>
				value ?
					seedPhraseVerifyModal.close()
				:	seedPhraseVerifyModal.open(seedPhraseVerifyModalState)
			}
			title="Seed Phrase"
		>
			{() => (
				<form
					class="mx-auto flex max-w-sm flex-col gap-4"
					onSubmit={async (e) => {
						e.preventDefault();
						const salt = seedPhraseVerifyModalState.salt;
						const encryptedString = seedPhraseVerifyModalState.encryptedString;
						const derivationKey = await getPasswordKey(inputs.join(' '));
						const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
						const decryptedString = await decryptDataWithKey(encryptedString, privateKey);
						if (decryptedString !== seedPhraseVerifyModalState.decryptedString) {
							toast.error('Verification failed');
							alert('Invalid seed phrase');
						} else {
							seedPhraseVerifyModalState.onVerified(inputs.join(' '));
							seedPhraseVerifyModal.close();
						}
					}}
				>
					<p>Paste or write down the pass phrase in the input boxes given to verify it.</p>
					<div class="flex items-center justify-end gap-2">
						<Button
							class="flex items-center gap-2"
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
							size="sm"
							variant="ghost"
						>
							<span class="i-heroicons:clipboard" />
							<span>Paste</span>
						</Button>
					</div>
					<div class="font-mono grid grid-cols-2 grid-rows-8 gap-2 rounded">
						<For each={Array.from({ length: 16 })}>
							{(_, index) => (
								<TextField>
									<TextFieldInput
										onInput={(e) => setInputs(index(), e.currentTarget.value)}
										onPaste={(event: ClipboardEvent) => {
											const data = event.clipboardData?.getData('text/plain');
											setTimeout(() => {
												const phrases = data
													?.trim()
													.split(' ')
													.map((s) => s.trim())
													.filter(Boolean);
												if (phrases) setInputs(phrases);
											});
										}}
										type="text"
										value={inputs[index()]}
									/>
								</TextField>
							)}
						</For>
					</div>
					<div class="flex justify-end gap-4">
						<Button
							onClick={() => {
								seedPhraseVerifyModal.close();
								seedPhraseVerifyModalState.onDismiss();
							}}
							variant="outline"
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
