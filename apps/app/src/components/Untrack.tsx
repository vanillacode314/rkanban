import { JSXElement, untrack } from 'solid-js';

export function Untrack(props: { children: JSXElement }) {
	return untrack(() => props.children);
}

export default Untrack;
