import { useSubmissions, type Action } from '@solidjs/router';
import { createEffect, untrack } from 'solid-js';

const memoMap = new Map<unknown, Map<unknown, unknown>>();
const resolved = new Set<unknown>();
function onSubmission<TInput extends unknown[], TOutput, TMemo>(
	action: Action<TInput, TOutput>,
	handlers: {
		onPending?: (input: TInput, memo: TMemo | undefined) => MaybePromise<TMemo | void>;
		onError?: (memo: TMemo | undefined, error: unknown) => MaybePromise<TMemo | void>;
		onSuccess?: (
			result: Exclude<TOutput, Error>,
			memo: TMemo | undefined
		) => MaybePromise<TMemo | void>;
	} = {},
	{
		predicate = () => true,
		always = false
	}: {
		predicate?: (input: TInput) => boolean;
		always?: boolean;
	} = {}
) {
	const submissions = useSubmissions(action);
	let dispatched = false;

	// eslint-disable-next-line solid/reactivity
	createEffect(async () => {
		for (const submission of submissions) {
			if (!dispatched && !always) return;
			if (resolved.has(submission)) continue;
			if (!predicate(submission.input!)) return;
			if (!memoMap.has(submission)) {
				memoMap.set(submission, new Map());
			}
			if (!memoMap.get(submission)!.has(handlers)) {
				memoMap.get(submission)!.set(handlers, undefined);
			}
			if (submission.pending) {
				// eslint-disable-next-line solid/reactivity
				untrack(async () => {
					let memo = memoMap.get(submission)!.get(handlers) as TMemo | undefined;
					const result = await handlers.onPending?.(submission.input, memo);
					if (result !== undefined) memo = result;
					memoMap.get(submission)!.set(handlers, memo);
				});
			} else if (submission.error || submission.result instanceof Error) {
				dispatched = false;
				resolved.add(submission);
				// eslint-disable-next-line solid/reactivity
				untrack(async () => {
					let memo = memoMap.get(submission)!.get(handlers) as TMemo | undefined;
					const result = await handlers.onError?.(memo, submission.error || submission.result);
					if (result !== undefined) memo = result;
					memoMap.get(submission)!.set(handlers, memo);
				});
			} else if (submission.result) {
				dispatched = false;
				resolved.add(submission);
				// eslint-disable-next-line solid/reactivity
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

	return () => {
		dispatched = true;
	};
}

export { onSubmission };
