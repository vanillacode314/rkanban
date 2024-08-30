import {
	JSXElement,
	Show,
	children,
	createEffect,
	createSignal,
	createUniqueId,
	mergeProps,
	untrack
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

type Props = {
	id?: string;
	title: string;
	children: (close: () => void) => JSXElement;
	closeOnOutsideClick?: boolean;
} & (
	| {
			trigger: JSXElement;
	  }
	| {
			trigger?: JSXElement;
			open: boolean;
			setOpen: (open: boolean) => void;
	  }
);

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
			closeOnOutsideClick: true
		},
		props
	);

	const [el, setEl] = createSignal<HTMLDialogElement>();

	const trigger = children(() => props.trigger);

	createEffect(() => {
		const { open } = mergedProps;
		untrack(() => {
			if (open) {
				el()?.showPopover();
			} else {
				el()?.hidePopover();
			}
		});
	});

	return (
		<>
			<Show when={trigger()}>
				<button popovertarget={mergedProps.id} class="contents">
					{trigger()}
				</button>
			</Show>
			<Portal>
				<dialog
					id={mergedProps.id}
					ref={setEl}
					popover
					onToggle={(event) => {
						mergedProps.setOpen(event.newState === 'open');
					}}
					class="h-full w-full bg-transparent"
				>
					<div
						class="grid h-full w-full items-end sm:place-content-center"
						onClick={(event) => {
							if (mergedProps.closeOnOutsideClick && event.target === event.currentTarget) {
								mergedProps.setOpen(false);
							}
						}}
					>
						<Card class="w-full sm:min-w-96">
							<CardHeader>
								<CardTitle>{props.title}</CardTitle>
							</CardHeader>
							<CardContent>
								<div>{props.children(() => mergedProps.setOpen(false))}</div>
							</CardContent>
						</Card>
					</div>
				</dialog>
			</Portal>
		</>
	);
}

export default Modal;
