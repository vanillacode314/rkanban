import { WindowEventListener } from '@solid-primitives/event-listener';
import { For, Match, Switch, createEffect } from 'solid-js';
import { createStore } from 'solid-js/store';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';
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
						onSubmit={(e) => {
							e.preventDefault();
							seedPhraseVerifyModal.open({ seedPhrase: seedPhraseModalState.seedPhrase });
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
									navigator.clipboard.writeText(seedPhraseModalState.seedPhrase);
								}}
								class="flex items-center gap-2"
								variant="ghost"
								size="sm"
							>
								<span class="i-heroicons:clipboard"></span>
								<span>Copy</span>
							</Button>
						</div>
						<div class="grid grid-cols-[1fr_auto_1fr_auto] grid-rows-8 rounded border p-4 font-mono">
							<For each={Array.from({ length: 32 }, (_, i) => i + 1)}>
								{(_, index) => (
									<Switch>
										<Match when={index() % 2 === 0}>
											<span>{phrases()[index() / 2]}</span>
										</Match>
										<Match when={index() % 2 === 1}>
											<span>&nbsp;</span>
										</Match>
									</Switch>
								)}
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

export default SeedPhrase;
