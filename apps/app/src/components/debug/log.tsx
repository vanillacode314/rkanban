import { JSXElement } from 'solid-js';

export function Log(props: { value: unknown | unknown[]; children?: JSXElement }) {
	const message = () => (Array.isArray(props.value) ? props.value : [props.value]);
	console.log(...message());
	return props.children;
}
