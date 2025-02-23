import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type } from 'arktype';
import { TBoard, TTask } from 'db/schema';
import { create } from 'mutative';
import { createMemo } from 'solid-js';

import { throwOnParseError } from '~/utils/arktype';
import { apiFetch } from '~/utils/fetchers';

import { queries } from '.';

const useBoardsByPathInputSchema = type({
	enabled: 'boolean = true',
	includeTasks: 'boolean = false',
	'path?': 'string | undefined'
});
function useBoardsByPath(input: () => typeof useBoardsByPathInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardsByPathInputSchema(input())));
	const boards = createQuery(() => ({
		...queries.boards.byPath({
			path: parsedInput().path!,
			includeTasks: parsedInput().includeTasks
		}),
		enabled: parsedInput().enabled && parsedInput().path !== undefined
	}));

	const createBoard = createMutation(() => ({
		mutationFn: (data: { nodePath: string } & Partial<TBoard>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<TBoard>(`/api/v1/private/boards/by-path`, {
					body: JSON.stringify({ ...data, nodePath: input().path }),
					method: 'POST'
				});
		},
		onMutate: () => {
			if (!input().path) throw new Error('No path');
		},
		onSuccess: (data) => {
			const push = create((draft: Array<{ tasks: TTask[] } & TBoard> | undefined) => {
				if (!draft) return;
				draft.push({ ...data, tasks: [] });
			});
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byPath({ path: input().path! }).queryKey },
				push
			);
			queryClient.setQueriesData({ queryKey: queries.boards.byId({ id: data.id }).queryKey }, data);
		}
	}));

	return [boards, { createBoard }] as const;
}

const useBoardInputSchema = type({
	'id?': 'string | undefined',
	includeTasks: 'boolean = false',
	enabled: 'boolean = true'
});
function useBoard(input: () => typeof useBoardInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardInputSchema(input())));
	const board = createQuery(() => ({
		...queries.boards.byId({ id: parsedInput().id!, includeTasks: parsedInput().includeTasks }),
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
		onSuccess: (data) => {
			const splice = create((draft: TBoard[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((board) => board.id === input().id);
				if (index === -1) return;
				draft.splice(index, 1);
			});
			queryClient.setQueryData(queries.boards.all.queryKey, splice);
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byPath({ path: data.path }).queryKey },
				splice
			);
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byId({ id: data.board.id }).queryKey },
				undefined
			);
		}
	}));

	const updateBoard = createMutation(() => ({
		mutationFn: (data: Partial<TBoard>) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' }).as_json<{
				board: TBoard;
				original: { board: TBoard; path: string };
				path: string;
			}>(`/api/v1/private/boards/${input().id}`, {
				body: JSON.stringify(data),
				method: 'PUT'
			});
		},
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: (data) => {
			const update = create((draft: Array<{ tasks: TTask[] } & TBoard> | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((board) => board.id === input().id);
				if (index === -1) return;
				Object.assign(draft[index], data.board);
			});
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byPath({ path: data.path }).queryKey },
				update
			);
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byId({ id: data.board.id }).queryKey },
				data.board
			);
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
			return queryClient.invalidateQueries({ queryKey: queries.boards._def });
		}
	}));

	return [board, { updateBoard, deleteBoard, shiftBoard }] as const;
}

const useBoardsInputSchema = type({
	enabled: 'boolean = true'
});
function useBoards(input: () => typeof useBoardsInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useBoardsInputSchema(input())));
	const boards = createQuery(() => ({
		...queries.boards.all,
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
		onSuccess: (data) => {
			const push = create((draft: Array<{ tasks: TTask[] } & TBoard> | undefined) => {
				if (!draft) return;
				draft.push({ ...data.board, tasks: [] });
			});
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byPath({ path: data.path }).queryKey },
				push
			);
			queryClient.setQueriesData(
				{ queryKey: queries.boards.byId({ id: data.board.id }) },
				data.board
			);
		}
	}));

	const shiftBoard = createMutation(() => ({
		mutationFn: (data: { direction: number; id: string }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/boards/${data.id}/shift`,
				{
					body: JSON.stringify(data),
					method: 'POST'
				}
			);
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: queries.boards._def });
		}
	}));

	return [boards, { createBoard, shiftBoard }] as const;
}

export { useBoard, useBoards, useBoardsByPath };
