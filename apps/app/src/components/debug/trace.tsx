import { JSXElement } from 'solid-js';

export function Trace(props: { children?: JSXElement; name: string }) {
	console.trace(props.name);
	return props.children;
}
