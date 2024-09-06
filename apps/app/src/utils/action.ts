import { useSubmissions, type Action } from '@solidjs/router';
import { createEffect } from 'solid-js';

function onSubmission<TInput extends any[], TOutput>(
	action: Action<TInput, TOutput>,
	handlers: {
		onPending?: (input: TInput) => void;
		onError?: () => void;
		onSuccess?: (result: Exclude<TOutput, Error>) => void;
	} = {}
) {
	const submissions = useSubmissions(action);
	createEffect(() => {
		for (const submission of submissions) {
			if (submission.pending) {
				handlers.onPending?.(submission.input);
			} else if (submission.error || submission.result instanceof Error) {
				handlers.onError?.();
			} else if (submission.result) {
				handlers.onSuccess?.(submission.result as unknown as Exclude<TOutput, Error>);
			}
		}
	});
}

export { onSubmission };
