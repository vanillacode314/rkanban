import { onMount } from 'solid-js';

export function Trace(props: { name: string }) {
	onMount(() => console.trace(props.name));
	return <>{}</>;
}
