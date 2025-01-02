import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { ValidComponent } from 'solid-js';

import * as TooltipPrimitive from '@kobalte/core/tooltip';
import { type Component, splitProps } from 'solid-js';

import { cn } from '~/lib/utils';

const TooltipTrigger = TooltipPrimitive.Trigger;

const Tooltip: Component<TooltipPrimitive.TooltipRootProps> = (props) => {
	return <TooltipPrimitive.Root gutter={4} {...props} />;
};

type TooltipContentProps<T extends ValidComponent = 'div'> = {
	class?: string | undefined;
} & TooltipPrimitive.TooltipContentProps<T>;

const TooltipContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, TooltipContentProps<T>>
) => {
	const [local, others] = splitProps(props as TooltipContentProps, ['class']);
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				class={cn(
					'animate-in fade-in-0 zoom-in-95 z-50 origin-[var(--kb-popover-content-transform-origin)] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
					local.class
				)}
				{...others}
			/>
		</TooltipPrimitive.Portal>
	);
};

export { Tooltip, TooltipContent, TooltipTrigger };
