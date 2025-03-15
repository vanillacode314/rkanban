import { useLocation } from '@solidjs/router';
import { animate, AnimationPlaybackControls, spring } from 'motion';
import {
	createEffect,
	createSignal,
	createUniqueId,
	JSXElement,
	mergeProps,
	onCleanup,
	untrack
} from 'solid-js';
import { Portal } from 'solid-js/web';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import Untrack from '~/components/Untrack';
import { cn } from '~/lib/utils';
import { isMobile } from '~/utils/media-queries';

export type TModalSource =
	| {
			height: number;
			left: number;
			top: number;
			width: number;
	  }
	| HTMLElement
	| null;

type Props = {
	children: ((close: () => void) => JSXElement) | JSXElement;
	closeOnOutsideClick?: boolean;
	fluid?: boolean;
	id?: string;
	onOpenChange?: (value: boolean) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	source?: TModalSource;
	title: string;
};

export function Modal(props: Props) {
	const location = useLocation();
	const internalId = createUniqueId();
	const [internalOpen, setInternalOpen] = createSignal<boolean>(false);
	const mergedProps = mergeProps(
		{
			closeOnOutsideClick: true,
			id: internalId,
			onOpenChange: () => {},
			get open() {
				return internalOpen();
			},
			setOpen: setInternalOpen,
			source: null
		},
		props
	);
	const [el, setEl] = createSignal<HTMLDialogElement>();
	let animation: AnimationPlaybackControls | null = null;

	createEffect(() => {
		const { hash } = location;

		untrack(() => {
			if (hash === `#modal-${internalId}`) return;
			el()?.close();
		});
	});

	createEffect(() => {
		const { open, source, onOpenChange } = mergedProps;
		const $el = el();
		untrack(() => {
			onOpenChange(open);
			if (!$el) return;
			const modalContentEl = $el.querySelector('[data-dialog-content]')! as HTMLElement;
			if (open) {
				window.location.hash = `modal-${internalId}`;
				$el.showModal();
				if (isMobile()) return;

				if (source instanceof HTMLElement) {
					const sourceRect = source.getBoundingClientRect();
					const destinationRect = modalContentEl.getBoundingClientRect();
					Object.assign(modalContentEl.style, {
						position: 'absolute',
						minWidth: '0px',
						minHeight: '0px'
					});
					animation = animate(
						modalContentEl,
						{
							top: [sourceRect.top, destinationRect.top],
							left: [sourceRect.left, destinationRect.left],
							width: [sourceRect.width, destinationRect.width],
							height: [sourceRect.height, destinationRect.height]
						},
						{ type: spring, mass: 0.5 }
					);
					animation.then(() => {
						Object.assign(modalContentEl.style, {
							position: '',
							minWidth: '',
							minHeight: '',
							top: '',
							left: '',
							width: '',
							height: ''
						});
						animation = null;
					});
				}
			} else {
				animation?.complete();
				$el.close();
			}
		});
	});

	onCleanup(() => {
		mergedProps.setOpen(false);
	});

	return (
		<Portal>
			<dialog
				class="relative isolate m-0 h-full max-h-full w-full max-w-full bg-transparent"
				id={mergedProps.id}
				onClose={() => mergedProps.setOpen(false)}
				ref={setEl}
			>
				<div
					class={cn(
						'sm:content-grid grid h-full w-full items-end sm:items-center sm:justify-items-center'
					)}
					onClick={(event) => {
						if (mergedProps.closeOnOutsideClick && event.target === event.currentTarget) {
							mergedProps.setOpen(false);
						}
					}}
				>
					<Card
						class={cn(
							'flex max-h-[90%] w-full flex-col overflow-hidden rounded-none border-0 border-t sm:rounded-lg sm:border',
							mergedProps.fluid ? 'h-full' : 'sm:max-w-96'
						)}
						data-dialog-content
					>
						<CardHeader>
							<CardTitle>{props.title}</CardTitle>
						</CardHeader>
						<CardContent class="grow">
							<Untrack>
								{typeof props.children === 'function' ?
									props.children(() => mergedProps.setOpen(false))
								:	props.children}
							</Untrack>
						</CardContent>
					</Card>
				</div>
			</dialog>
		</Portal>
	);
}

export default Modal;
