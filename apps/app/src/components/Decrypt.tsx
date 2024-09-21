import { createAsync } from '@solidjs/router';
import { createQuery } from '@tanstack/solid-query';
import { createSignal, JSXElement, onMount, Show, Suspense } from 'solid-js';
import { isServer } from 'solid-js/web';

import { decryptWithUserKeys, isEncryptionEnabled } from '~/utils/auth.server';

const DefaultFallback = () => (
	<span class="flex items-center gap-2">
		<span class="i-heroicons:arrow-path-rounded-square shrink-0 animate-spin" />
		<span>Decrypting&hellip;</span>
	</span>
);

export const createClientSignal =
	isServer ?
		(): (() => boolean) => () => false
	:	(): (() => boolean) => {
			const [flag, setFlag] = createSignal(false);

			onMount(() => {
				setFlag(true);
			});

			return flag;
		};

export interface ClientOnlyProps {
	children?: JSXElement;
	fallback?: JSXElement;
}

export const ClientOnly = (props: ClientOnlyProps): JSXElement => {
	const isClient = createClientSignal();

	return (
		<Show fallback={props.fallback} keyed={false} when={isClient()}>
			{props.children}
		</Show>
	);
};

export function BaseDecrypt(props: {
	children: (decryptedValue: () => string) => JSXElement;
	fallback?: JSXElement | true;
	value?: string;
}) {
	const decryptedValue = createQuery(() => ({
		queryFn: (context) => decryptWithUserKeys(context.queryKey[1]),
		queryKey: ['decryptedValue', props.value] as const
	}));

	return (
		<Suspense fallback={props.fallback}>
			<Show when={decryptedValue.data !== null}>{props.children(() => decryptedValue.data!)}</Show>
		</Suspense>
	);
}

export function Decrypt(props: {
	children: (decryptedValue: () => string) => JSXElement;
	fallback?: JSXElement | true;
	value?: string;
}) {
	const encryptionEnabled = createAsync(isEncryptionEnabled, { deferStream: true });
	const fallback = () => (props.fallback === true ? <DefaultFallback /> : props.fallback);

	return (
		<Suspense>
			<Show fallback={<>{props.children(() => props.value!)}</>} when={encryptionEnabled()}>
				<ClientOnly fallback={fallback()}>
					<BaseDecrypt {...props} fallback={fallback()} />
				</ClientOnly>
			</Show>
		</Suspense>
	);
}

export default Decrypt;
