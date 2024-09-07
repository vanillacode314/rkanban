import { createQuery } from '@tanstack/solid-query';
import { createSignal, JSXElement, onMount, Show, Suspense } from 'solid-js';
import { isServer } from 'solid-js/web';
import { decryptWithUserKeys } from '~/utils/auth.server';

const DefaultFallback = () => (
	<span class="flex items-center gap-2">
		<span class="i-heroicons:arrow-path-rounded-square shrink-0 animate-spin"></span>
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
	fallback?: JSXElement;
	children?: JSXElement;
}

export const ClientOnly = (props: ClientOnlyProps): JSXElement => {
	const isClient = createClientSignal();

	return Show({
		keyed: false,
		get when() {
			return isClient();
		},
		get fallback() {
			return props.fallback;
		},
		get children() {
			return props.children;
		}
	});
};

export function BaseDecrypt(props: {
	children: (decryptedValue: () => string) => JSXElement;
	value?: string;
	fallback?: JSXElement | true;
}) {
	const decryptedValue = createQuery(() => ({
		queryKey: ['decryptedValue', props.value] as const,
		queryFn: (context) => decryptWithUserKeys(context.queryKey[1])
	}));

	return (
		<Suspense fallback={props.fallback}>
			<Show when={decryptedValue.data !== null}>{props.children(() => decryptedValue.data!)}</Show>
		</Suspense>
	);
}

export function Decrypt(props: {
	children: (decryptedValue: () => string) => JSXElement;
	value?: string;
	fallback?: JSXElement | true;
}) {
	const fallback = () => (props.fallback === true ? <DefaultFallback /> : props.fallback);
	return (
		<ClientOnly fallback={fallback()}>
			<BaseDecrypt {...props} fallback={fallback()} />
		</ClientOnly>
	);
}

export default Decrypt;
