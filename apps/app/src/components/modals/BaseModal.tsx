import {
	JSXElement,
	createEffect,
	createSignal,
	createUniqueId,
	mergeProps,
	untrack
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import Untrack from '../Untrack';

type Props = {
	id?: string;
	title: string;
	children: (close: () => void) => JSXElement;
	closeOnOutsideClick?: boolean;
	onOpenChange?: (value: boolean) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function Modal(props: Props) {
	const internalId = createUniqueId();
	const [internalOpen, setInternalOpen] = createSignal<boolean>(false);
	const mergedProps = mergeProps(
		{
			get open() {
				return internalOpen();
			},
			id: internalId,
			setOpen: setInternalOpen,
			closeOnOutsideClick: true,
			onOpenChange: () => {}
		},
		props
	);

	const [el, setEl] = createSignal<HTMLDialogElement>();

	createEffect(() => {
		const { open } = mergedProps;
		untrack(() => {
			mergedProps.onOpenChange(open);
			if (open) {
				el()?.showModal();
			} else {
				el()?.close();
			}
		});
	});

	return (
		<Portal>
			<dialog
				id={mergedProps.id}
				ref={setEl}
				onClose={() => {
					mergedProps.setOpen(false);
					const forms = el()?.querySelectorAll('form');
					forms?.forEach((form) => form.reset());
				}}
				class="m-0 h-full w-full max-w-full bg-transparent"
			>
				<div
					class="grid h-full w-full items-end sm:place-content-center"
					onClick={(event) => {
						if (mergedProps.closeOnOutsideClick && event.target === event.currentTarget) {
							mergedProps.setOpen(false);
						}
					}}
				>
					<Card class="w-full rounded-none border-0 border-t sm:min-w-96 sm:rounded-sm sm:border">
						<CardHeader>
							<CardTitle>{props.title}</CardTitle>
						</CardHeader>
						<CardContent>
							<div>
								<Untrack>{props.children(() => mergedProps.setOpen(false))}</Untrack>
							</div>
						</CardContent>
					</Card>
				</div>
			</dialog>
		</Portal>
	);
}

export default Modal;
