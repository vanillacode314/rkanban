import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type } from 'arktype';
import { TTask } from 'db/schema';
import { createMemo } from 'solid-js';

import { throwOnParseError } from '~/utils/arktype';
import { apiFetch } from '~/utils/fetchers';

import { queries } from '.';

const useTasksByBoardIdInputSchema = type({
	boardId: 'string',
	enabled: 'boolean = true'
});

function useTasksByBoardId(input: () => typeof useTasksByBoardIdInputSchema.inferIn) {
	const parsedInput = createMemo(() => throwOnParseError(useTasksByBoardIdInputSchema(input())));
	const tasks = createQuery(() => ({
		...queries.tasks.byBoardId({ boardId: parsedInput().boardId }),
		enabled: parsedInput().enabled && parsedInput().boardId !== undefined
	}));

	return [tasks, {}] as const;
}

const useTaskInputSchema = type({
	'id?': 'string | undefined',
	enabled: 'boolean = true'
});

function useTask(input: () => typeof useTaskInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useTaskInputSchema(input())));
	const task = createQuery(() => ({
		...queries.tasks.byId({ id: parsedInput().id! }),
		enabled: parsedInput().enabled && parsedInput().id !== undefined
	}));
	const updateTask = createMutation(() => ({
		mutationFn: (data: Partial<TTask>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ task: TTask }>(`/api/v1/private/tasks/${data.id}`, {
					body: JSON.stringify(data),
					method: 'PUT'
				});
		},
		onMutate: (data) => {
			if (!data.id) throw new Error('No task id');
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	const deleteTask = createMutation(() => ({
		mutationFn: () => {
			return apiFetch.as_json<{ task: TTask }>(`/api/v1/private/tasks/${input().id}`, {
				method: 'DELETE'
			});
		},
		onMutate: () => {
			if (!input().id) throw new Error('No task id');
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	const shiftTask = createMutation(() => ({
		mutationFn: (direction: number) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/tasks/${input().id}/shift`,
				{
					body: JSON.stringify({ direction }),
					method: 'POST'
				}
			);
		},
		onMutate: () => {
			if (!input().id) throw new Error('No task id');
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	const changeBoard = createMutation(() => ({
		mutationFn: (data: { boardId: string; index: number }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/tasks/${input().id}/change-board`,
				{
					body: JSON.stringify(data),
					method: 'POST'
				}
			);
		},
		onMutate: () => {
			if (!input().id) throw new Error('No task id');
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	return [task, { changeBoard, shiftTask, updateTask, deleteTask }] as const;
}

const useTasksInputSchema = type({
	enabled: 'boolean = true'
});
function useTasks(input: () => typeof useTasksInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useTasksInputSchema(input())));
	const tasks = createQuery(() => ({
		...queries.tasks.all,
		enabled: parsedInput().enabled
	}));

	const createTask = createMutation(() => ({
		mutationFn: (data: { boardId: string } & Partial<TTask>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ task: TTask }>(`/api/v1/private/tasks`, {
					body: JSON.stringify({ ...data, boardId: data.boardId }),
					method: 'POST'
				});
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	const shiftTask = createMutation(() => ({
		mutationFn: (data: { direction: number; id: string }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/tasks/${data.id}/shift`,
				{
					body: JSON.stringify(data),
					method: 'POST'
				}
			);
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	const changeBoard = createMutation(() => ({
		mutationFn: (data: { boardId: string; id: string; index: number }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' })(
				`/api/v1/private/tasks/${data.id}/change-board`,
				{
					body: JSON.stringify(data),
					method: 'POST'
				}
			);
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: queries.boards._def }),
				queryClient.invalidateQueries({ queryKey: queries.tasks._def })
			]);
		}
	}));

	return [tasks, { changeBoard, shiftTask, createTask }] as const;
}

export { useTask, useTasks, useTasksByBoardId };
