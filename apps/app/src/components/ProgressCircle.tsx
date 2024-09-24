import { createMemo, Show } from 'solid-js';

import { cn } from '~/lib/utils';
import { round } from '~/utils/math';

export const ProgressCircle = (props: { class?: string; text?: string; value: number }) => {
	const radius = 9;
	const angle = createMemo(() => Math.PI * 2 * Math.min(props.value, 0.999));
	const large = createMemo(() => (angle() > Math.PI ? 1 : 0));
	const x = createMemo(() => round(-Math.cos(angle()) * radius + 12, 2));
	const y = createMemo(() => round(-Math.sin(angle()) * radius + 12, 2));
	const circumference = createMemo(() => angle() * radius);

	return (
		<div class={cn('relative', props.class)}>
			<span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[.5em] font-bold">
				{props.text}
			</span>
			<svg height="1em" style={{ height: '1em', width: '1em' }} viewBox="0 0 24 24" width="1em">
				<Show when={props.value > 0}>
					<path
						d={`M 3 12 
          A 9 9 
          0 ${large()} 1 
          ${x()} ${y()}
        Z`}
						fill="none"
						stroke="currentColor"
						stroke-dasharray={circumference().toString()}
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
					/>
				</Show>
			</svg>
		</div>
	);
};

export default ProgressCircle;
