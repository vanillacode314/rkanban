import { cn } from '~/lib/utils';

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const ProgressCircle = (props: { class?: string; text?: string; value: number }) => {
	return (
		<div class={cn('relative', props.class)}>
			<span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[.5em] font-bold">
				{props.text}
			</span>
			<svg
				class="-rotate-90"
				height="1em"
				style={{ height: '1em', width: '1em' }}
				viewBox="0 0 24 24"
				width="1em"
			>
				<circle
					cx="12"
					cy="12"
					fill="none"
					r="9"
					stroke="currentColor"
					stroke-dasharray={CIRCUMFERENCE.toString()}
					stroke-dashoffset={((1 - props.value) * CIRCUMFERENCE).toString()}
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
				/>
			</svg>
		</div>
	);
};

export default ProgressCircle;
