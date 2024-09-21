import { JSXElement } from 'solid-js';

export function Log(props: { children?: JSXElement; value: unknown | unknown[] }) {
	const message = () => (Array.isArray(props.value) ? props.value : [props.value]);
	console.log(...message());
	return props.children;
}
