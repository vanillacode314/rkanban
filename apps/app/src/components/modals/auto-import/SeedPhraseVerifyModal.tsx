import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
import { TextField, TextFieldInput } from '~/components/ui/text-field';
import { decryptDataWithKey, deriveKey, getPasswordKey } from '~/utils/crypto';
import { useSeedPhraseModal } from './SeedPhraseModal';

type TSeedPhraseState = {
	encryptedString: string;
	decryptedString: string;
	salt: Uint8Array;
	onVerified: (seedPhrase: string) => void;
	onDismiss: () => void;
};
const [seedPhraseVerifyModalState, setSeedPhraseVerifyModalState] = createStore<TSeedPhraseState>({
	encryptedString: '',
	decryptedString: '',
	salt: new Uint8Array(),
	onVerified: () => {},
	onDismiss: () => {}
});
export function useSeedPhraseVerifyModal() {
	return {
		open: (state: TSeedPhraseState) => setSeedPhraseVerifyModalState(state),
		close: () =>
			setSeedPhraseVerifyModalState({
				encryptedString: '',
				decryptedString: '',
				salt: new Uint8Array(),
				onVerified: () => {},
				onDismiss: () => {}
			})
	};
}

export function SeedPhrase() {
	const seedPhraseVerifyModal = useSeedPhraseVerifyModal();
	const [inputs, setInputs] = createStore<string[]>([]);

	return (
		<BaseModal
			onOpenChange={(value) => {
				if (value) setInputs(Array(16).fill(''));
			}}
			title="Seed Phrase"
			closeOnOutsideClick={false}
			open={seedPhraseVerifyModalState.encryptedString !== ''}
			setOpen={(value) =>
				value ?
					seedPhraseVerifyModal.close()
				:	seedPhraseVerifyModal.open(seedPhraseVerifyModalState)
			}
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
													.map((s) => s.trim())
													.filter(Boolean);
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
								seedPhraseVerifyModal.close();
								seedPhraseVerifyModalState.onDismiss();
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
