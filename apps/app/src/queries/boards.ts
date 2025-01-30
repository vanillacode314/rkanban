import { createMutation, createQuery, queryOptions, useQueryClient } from '@tanstack/solid-query';
import { TBoard, TTask } from 'db/schema';
import { type } from 'arktype';

import { apiFetch } from '~/utils/fetchers';
import { throwOnParseError } from '~/utils/arktype';
import { createMemo } from 'solid-js';

const useBoardsByPathInputSchema = type({
	enabled: 'boolean = true',
	includeTasks: 'boolean = false',
	'path?': 'string | undefined'
});
const useBoardsByPathQueryOptions = ({
	path,
	includeTasks
}: typeof useBoardsByPathInputSchema.infer) =>
	queryOptions({
		enabled: path !== undefined,
		queryFn: ({ queryKey }) => {
			const searchParams = new URLSearchParams({
				includeTasks: String(queryKey[3]),
				path: String(queryKey[2])
			});
			return apiFetch
				.forwardHeaders()
				.as_json<
					Array<{ tasks: TTask[] } & TBoard>
				>(`/api/v1/private/boards/by-path?${searchParams.toString()}`);
		},
		queryKey: ['boards', 'by-path', path, includeTasks] as const
	});
function useBoardsByPath(input: () => typeof useBoardsByPathInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardsByPathInputSchema(input())));
	const boards = createQuery(() => ({
		...useBoardsByPathQueryOptions(parsedInput()),
		enabled: parsedInput().enabled && parsedInput().path !== undefined
	}));

	const createBoard = createMutation(() => ({
		mutationFn: (data: Partial<TBoard> & { nodePath: string }) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ board: TBoard; path: string }>(`/api/v1/private/boards/by-path`, {
					body: JSON.stringify({ ...data, nodePath: input().path }),
					method: 'POST'
				});
		},
		onMutate: () => {
			if (!input().path) throw new Error('No path');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	return [boards, { createBoard }] as const;
}

const useBoardInputSchema = type({
	'id?': 'string | undefined',
	includeTasks: 'boolean = false',
	enabled: 'boolean = true'
});
const useBoardQueryOptions = ({ id, includeTasks }: typeof useBoardInputSchema.infer) =>
	queryOptions({
		enabled: id !== undefined,
		queryFn: ({ queryKey }) => {
			const searchParams = new URLSearchParams({
				includeTasks: String(queryKey[2])
			});
			return apiFetch
				.forwardHeaders()
				.as_json<
					{ tasks: TTask[] } & TBoard
				>(`/api/v1/private/boards/${queryKey[1]}?${searchParams.toString()}`);
		},
		queryKey: ['boards', id, includeTasks]
	});
function useBoard(input: () => typeof useBoardInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardInputSchema(input())));
	const board = createQuery(() => ({
		...useBoardQueryOptions(parsedInput()),
		enabled: parsedInput().enabled && parsedInput().id !== undefined
	}));

	const deleteBoard = createMutation(() => ({
		mutationFn: () =>
			apiFetch.as_json<{ board: TBoard; path: string }>(`/api/v1/private/boards/${input().id}`, {
				method: 'DELETE'
			}),
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	const updateBoard = createMutation(() => ({
		mutationFn: (data: Partial<TBoard>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ board: TBoard; path: string }>(`/api/v1/private/boards/${input().id}`, {
					body: JSON.stringify(data),
					method: 'PUT'
				});
		},
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	const shiftBoard = createMutation(() => ({
		mutationFn: (direction: number) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/boards/${input().id}/shift`,
				{
					body: JSON.stringify({ direction }),
					method: 'POST'
				}
			);
		},
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	return [board, { updateBoard, deleteBoard, shiftBoard }] as const;
}

const useBoardsInputSchema = type({
	enabled: 'boolean = true'
});
const useBoardsQueryOptions = () =>
	queryOptions({
		queryFn: () =>
			apiFetch
				.forwardHeaders()
				.as_json<Array<{ tasks: TTask[] } & TBoard>>(`/api/v1/private/boards`),
		queryKey: ['boards']
	});
function useBoards(input: () => typeof useBoardsInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardsInputSchema(input())));
	const boards = createQuery(() => ({
		...useBoardsQueryOptions(),
		enabled: parsedInput().enabled
	}));

	const createBoard = createMutation(() => ({
		mutationFn: (data: Partial<TBoard>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ board: TBoard; path: string }>(`/api/v1/private/boards`, {
					body: JSON.stringify(data),
					method: 'POST'
				});
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	const shiftBoard = createMutation(() => ({
		mutationFn: (data: { id: string; direction: number }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/boards/${data.id}/shift`,
				{
					body: JSON.stringify(data),
					method: 'POST'
				}
			);
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['boards'] });
		}
	}));

	return [boards, { createBoard, shiftBoard }] as const;
}

export { useBoardsByPath, useBoard, useBoards };
