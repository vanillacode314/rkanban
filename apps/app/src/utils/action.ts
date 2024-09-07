import { useSubmissions, type Action } from '@solidjs/router';
import { createEffect, untrack } from 'solid-js';

const memoMap = new Map<unknown, Map<unknown, unknown>>();
const resolved = new Set<unknown>();
function onSubmission<TInput extends any[], TOutput, TMemo>(
	action: Action<TInput, TOutput>,
	handlers: {
		onPending?: (input: TInput, memo: TMemo | undefined) => MaybePromise<TMemo | void>;
		onError?: (memo: TMemo | undefined) => MaybePromise<TMemo | void>;
		onSuccess?: (
			result: Exclude<TOutput, Error>,
			memo: TMemo | undefined
		) => MaybePromise<TMemo | void>;
	} = {},
	predicate: (input: TInput) => boolean = () => true
) {
	const submissions = useSubmissions(action);

	createEffect(async () => {
		for (const submission of submissions) {
			if (resolved.has(submission)) continue;
			if (!predicate(submission.input!)) return;
			if (!memoMap.has(submission)) {
				memoMap.set(submission, new Map());
			}
			if (!memoMap.get(submission)!.has(handlers)) {
				memoMap.get(submission)!.set(handlers, undefined);
			}
			if (submission.pending) {
				untrack(async () => {
					let memo = memoMap.get(submission)!.get(handlers) as TMemo | undefined;
					const result = await handlers.onPending?.(submission.input, memo);
					if (result !== undefined) memo = result;
					memoMap.get(submission)!.set(handlers, memo);
				});
			} else if (submission.error || submission.result instanceof Error) {
				resolved.add(submission);
				untrack(async () => {
					let memo = memoMap.get(submission)!.get(handlers) as TMemo | undefined;
					const result = await handlers.onError?.(memo);
					if (result !== undefined) memo = result;
					memoMap.get(submission)!.set(handlers, memo);
				});
			} else if (submission.result) {
				resolved.add(submission);
				untrack(async () => {
					let memo = memoMap.get(submission)!.get(handlers) as TMemo | undefined;
					const result = await handlers.onSuccess?.(
						submission.result as unknown as Exclude<TOutput, Error>,
						memo
					);
					if (result !== undefined) memo = result;
					memoMap.get(submission)!.set(handlers, memo);
				});
			}
		}
	});
}

export { onSubmission };
