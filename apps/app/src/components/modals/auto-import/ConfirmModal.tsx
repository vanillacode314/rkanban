import { createStore } from 'solid-js/store';

import BaseModal from '~/components/modals/BaseModal';
import { Button } from '~/components/ui/button';

type TConfirmModalState = {
	message: string;
	onNo: () => void;
	onYes: () => void;
	open: boolean;
	title: string;
};
const [confirmModalState, setConfirmModalState] = createStore<TConfirmModalState>({
	message: '',
	onNo: () => {},
	onYes: () => {},
	open: false,
	title: ''
});

export function useConfirmModal() {
	return {
		close: () =>
			setConfirmModalState({
				message: '',
				onNo: () => {},
				onYes: () => {},
				open: false,
				title: ''
			}),
		open: ({
			message,
			onNo = () => {},
			onYes = () => {},
			title
		}: Omit<TConfirmModalState, 'onNo' | 'onYes' | 'open'> &
			Partial<Pick<TConfirmModalState, 'onNo' | 'onYes'>>) =>
			setConfirmModalState({
				message,
				onNo,
				onYes,
				open: true,
				title
			})
	};
}

export function ConfirmModal() {
	const confirmModal = useConfirmModal();

	return (
		<BaseModal
			open={confirmModalState.open}
			setOpen={(value) => setConfirmModalState('open', value)}
			title={confirmModalState.title}
		>
			{() => (
				<form
					class="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						confirmModalState.onYes();
						confirmModal.close();
					}}
				>
					<p>{confirmModalState.message}</p>
					<div class="flex justify-end gap-4">
						<Button
							onClick={() => {
								confirmModalState.onNo();
								confirmModal.close();
							}}
							variant="outline"
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
