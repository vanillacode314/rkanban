import { For, Show } from 'solid-js';

export function ValidationErrors(props: { errors: string[] | undefined }) {
	return (
		<Show when={props.errors && props.errors.length > 0}>
			<div class="flex flex-col">
				<For each={props.errors}>
					{(error) => <span class="text-sm text-error-foreground">{error}</span>}
				</For>
			</div>
		</Show>
	);
}

export default ValidationErrors;
