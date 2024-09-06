import { JSXElement, onMount } from 'solid-js';

export function Log(props: { value: unknown | unknown[]; children?: JSXElement }) {
	const message = () => (Array.isArray(props.value) ? props.value : [props.value]);
	onMount(() => console.log(...message()));
	return props.children;
}
