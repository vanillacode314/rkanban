import { JSXElement, onMount } from 'solid-js';

export function Trace(props: { name: string; children?: JSXElement }) {
	console.trace(props.name);
	return props.children;
}
