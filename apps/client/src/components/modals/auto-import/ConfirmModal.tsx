import { createEffect } from 'solid-js';
import { createStore } from 'solid-js/store';
import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';

type TConfirmModalState = {
	open: boolean;
	title: string;
	message: string;
	onYes: () => void;
	onNo: () => void;
};
const [confirmModalState, setConfirmModalState] = createStore<TConfirmModalState>({
	open: false,
	title: '',
	message: '',
	onYes: () => {},
	onNo: () => {}
});

export function useConfirmModal() {
	return {
		open: ({
			title,
			message,
			onYes = () => {},
			onNo = () => {}
		}: Omit<TConfirmModalState, 'open' | 'onYes' | 'onNo'> &
			Partial<Pick<TConfirmModalState, 'onYes' | 'onNo'>>) =>
			setConfirmModalState({
				open: true,
				title,
				message,
				onYes,
				onNo
			}),
		close: () =>
			setConfirmModalState({
				open: false,
				title: '',
				message: '',
				onYes: () => {},
				onNo: () => {}
			})
	};
}

export function ConfirmModal() {
	const confirmModal = useConfirmModal();

	return (
		<BaseModal
			title={confirmModalState.title}
			open={confirmModalState.open}
			setOpen={(value) => setConfirmModalState('open', value)}
		>
			{(close) => (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						confirmModalState.onYes();
						confirmModal.close();
					}}
					class="flex flex-col gap-4"
				>
					<p>{confirmModalState.message}</p>
					<div class="flex justify-end gap-4">
						<Button
							variant="outline"
							onClick={() => {
								confirmModalState.onNo();
								confirmModal.close();
							}}
						>
							No
						</Button>
						<Button autofocus type="submit">
							Yes
						</Button>
					</div>
				</form>
			)}
		</BaseModal>
	);
}

export default ConfirmModal;
