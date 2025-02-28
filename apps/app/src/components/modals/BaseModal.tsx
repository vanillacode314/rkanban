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
	children: (close: () => void) => JSXElement;
	closeOnOutsideClick?: boolean;
	id?: string;
	onOpenChange?: (value: boolean) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
	source?: TModalSource;
	title: string;
};

export function Modal(props: Props) {
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
		const { open, source, onOpenChange } = mergedProps;
		const $el = el();
		untrack(() => {
			onOpenChange(open);
			if (!$el) return;
			const modalContentEl = $el.querySelector('[data-dialog-content]')! as HTMLElement;
			if (open) {
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
				onClose={() => {
					mergedProps.setOpen(false);
					const forms = el()?.querySelectorAll('form');
					forms?.forEach((form) => form.reset());
				}}
				ref={setEl}
			>
				<div
					class="grid h-full w-full items-end sm:place-content-center"
					onClick={(event) => {
						if (mergedProps.closeOnOutsideClick && event.target === event.currentTarget) {
							mergedProps.setOpen(false);
						}
					}}
				>
					<Card
						class="w-full overflow-hidden rounded-none border-0 border-t sm:min-w-96 sm:rounded-sm sm:border"
						data-dialog-content
					>
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
