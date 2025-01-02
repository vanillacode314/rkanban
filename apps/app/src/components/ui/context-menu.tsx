import type { PolymorphicProps } from '@kobalte/core/polymorphic';
import type { Component, ComponentProps, JSX, ValidComponent } from 'solid-js';

import * as ContextMenuPrimitive from '@kobalte/core/context-menu';
import { splitProps } from 'solid-js';

import { cn } from '~/lib/utils';

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.Sub;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenu: Component<ContextMenuPrimitive.ContextMenuRootProps> = (props) => {
	return <ContextMenuPrimitive.Root gutter={4} {...props} />;
};

type ContextMenuContentProps<T extends ValidComponent = 'div'> = {
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuContentProps<T>;

const ContextMenuContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuContentProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuContentProps, ['class']);
	return (
		<ContextMenuPrimitive.Portal>
			<ContextMenuPrimitive.Content
				class={cn(
					'animate-in z-50 min-w-32 origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
					local.class
				)}
				{...others}
			/>
		</ContextMenuPrimitive.Portal>
	);
};

type ContextMenuItemProps<T extends ValidComponent = 'div'> = {
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuItemProps<T>;

const ContextMenuItem = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuItemProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuItemProps, ['class']);
	return (
		<ContextMenuPrimitive.Item
			class={cn(
				'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				local.class
			)}
			{...others}
		/>
	);
};

const ContextMenuShortcut: Component<ComponentProps<'span'>> = (props) => {
	const [local, others] = splitProps(props, ['class']);
	return <span class={cn('ml-auto text-xs tracking-widest opacity-60', local.class)} {...others} />;
};

type ContextMenuSeparatorProps<T extends ValidComponent = 'hr'> = {
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuSeparatorProps<T>;

const ContextMenuSeparator = <T extends ValidComponent = 'hr'>(
	props: PolymorphicProps<T, ContextMenuSeparatorProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuSeparatorProps, ['class']);
	return (
		<ContextMenuPrimitive.Separator
			class={cn('-mx-1 my-1 h-px bg-muted', local.class)}
			{...others}
		/>
	);
};

type ContextMenuSubTriggerProps<T extends ValidComponent = 'div'> = {
	children?: JSX.Element;
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuSubTriggerProps<T>;

const ContextMenuSubTrigger = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuSubTriggerProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuSubTriggerProps, ['class', 'children']);
	return (
		<ContextMenuPrimitive.SubTrigger
			class={cn(
				'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
				local.class
			)}
			{...others}
		>
			{local.children}
			<svg
				class="ml-auto size-4"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M9 6l6 6l-6 6" />
			</svg>
		</ContextMenuPrimitive.SubTrigger>
	);
};

type ContextMenuSubContentProps<T extends ValidComponent = 'div'> = {
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuSubContentProps<T>;

const ContextMenuSubContent = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuSubContentProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuSubContentProps, ['class']);
	return (
		<ContextMenuPrimitive.SubContent
			class={cn(
				'animate-in z-50 min-w-32 origin-[var(--kb-menu-content-transform-origin)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
				local.class
			)}
			{...others}
		/>
	);
};

type ContextMenuCheckboxItemProps<T extends ValidComponent = 'div'> = {
	children?: JSX.Element;
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuCheckboxItemProps<T>;

const ContextMenuCheckboxItem = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuCheckboxItemProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuCheckboxItemProps, ['class', 'children']);
	return (
		<ContextMenuPrimitive.CheckboxItem
			class={cn(
				'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				local.class
			)}
			{...others}
		>
			<span class="absolute left-2 flex size-3.5 items-center justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<svg
						class="size-4"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M5 12l5 5l10 -10" />
					</svg>
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{local.children}
		</ContextMenuPrimitive.CheckboxItem>
	);
};

type ContextMenuGroupLabelProps<T extends ValidComponent = 'span'> = {
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuGroupLabelProps<T>;

const ContextMenuGroupLabel = <T extends ValidComponent = 'span'>(
	props: PolymorphicProps<T, ContextMenuGroupLabelProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuGroupLabelProps, ['class']);
	return (
		<ContextMenuPrimitive.GroupLabel
			class={cn('px-2 py-1.5 text-sm font-semibold', local.class)}
			{...others}
		/>
	);
};

type ContextMenuRadioItemProps<T extends ValidComponent = 'div'> = {
	children?: JSX.Element;
	class?: string | undefined;
} & ContextMenuPrimitive.ContextMenuRadioItemProps<T>;

const ContextMenuRadioItem = <T extends ValidComponent = 'div'>(
	props: PolymorphicProps<T, ContextMenuRadioItemProps<T>>
) => {
	const [local, others] = splitProps(props as ContextMenuRadioItemProps, ['class', 'children']);
	return (
		<ContextMenuPrimitive.RadioItem
			class={cn(
				'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				local.class
			)}
			{...others}
		>
			<span class="absolute left-2 flex size-3.5 items-center justify-center">
				<ContextMenuPrimitive.ItemIndicator>
					<svg
						class="size-2 fill-current"
						fill="none"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
					</svg>
				</ContextMenuPrimitive.ItemIndicator>
			</span>
			{local.children}
		</ContextMenuPrimitive.RadioItem>
	);
};

export {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuGroupLabel,
	ContextMenuItem,
	ContextMenuPortal,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger
};
