import { resolveFirst } from '@solid-primitives/refs';
import { createSwitchTransition } from '@solid-primitives/transition-group';
import { animate, spring } from 'motion';
import { createMemo, JSXElement } from 'solid-js';

export function TransitionSlide(props: { appear?: boolean; children: JSXElement }): JSXElement {
	const resolved = resolveFirst(
		() => props.children,
		(el) => el instanceof HTMLElement
	);
	const transition = createMemo(() =>
		createSwitchTransition(resolved, {
			appear: props.appear,
			onEnter(el) {
				queueMicrotask(() => {
					animate(
						el,
						{ x: '-50%', y: ['-100%', 0] },
						{ x: { duration: 0 }, y: { easing: spring() } }
					);
				});
			}
		})
	);

	return <>{transition()()}</>;
}
