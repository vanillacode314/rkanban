import { useLocation } from '@solidjs/router';
import { createEffect, createSignal, For, on, Show, untrack } from 'solid-js';

import { cn } from '~/lib/utils';

import { Button } from './ui/button';

export type TAction = {
	handler: (event?: Event) => Promise<unknown> | unknown;
	icon: string;
	label: string;
	variant?: Parameters<typeof Button>[0]['variant'];
};

export function Fab(props: { actions: TAction[] }) {
	const location = useLocation();
	let ref!: HTMLButtonElement;
	const [open, setOpen] = createSignal<boolean>(false);

	function toggle() {
		setOpen(!open());
	}

	createEffect(() => {
		const { hash } = location;
		untrack(() => {
			if (hash === `#fab`) return;
			setOpen(false);
		});
	});

	createEffect(
		on(
			open,
			($open) => {
				if ($open) {
					window.location.hash = '#fab';
					ref.classList.remove('motion-rotate-in-45');
					ref.classList.add('motion-rotate-out-45');
				} else {
					ref.classList.remove('motion-rotate-out-45');
					ref.classList.add('motion-rotate-in-45');
				}
			},
			{ defer: true }
		)
	);

	return (
		<>
			<Show when={open()}>
				<button class="fixed inset-0 z-20 backdrop-blur md:hidden" onClick={() => setOpen(false)} />
			</Show>
			<div class="fixed bottom-4 right-4 z-30 flex flex-col gap-4 md:hidden">
				<Show when={open()}>
					<ul class="flex flex-col gap-4">
						<For each={props.actions}>
							{(action) => (
								<li class="contents">
									<Button
										class="motion-preset-pop flex items-center justify-end gap-2 self-end motion-duration-300"
										onClick={async () => {
											await action.handler();
											setOpen(false);
										}}
										variant={action.variant}
									>
										<span class="text-xs font-bold uppercase tracking-wide">{action.label}</span>
										<span class={cn(action.icon, 'text-lg')} />
									</Button>
								</li>
							)}
						</For>
					</ul>
				</Show>
				<Button
					class="size-12 self-end motion-duration-300 motion-ease-spring-bounciest/rotate"
					onClick={toggle}
					ref={ref}
					size="icon"
				>
					<span class="i-heroicons:plus text-2xl" />
				</Button>
			</div>
		</>
	);
}
