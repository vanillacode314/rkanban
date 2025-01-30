import { createMutation, createQuery, queryOptions, useQueryClient } from '@tanstack/solid-query';
import { TTask } from 'db/schema';
import { type } from 'arktype';
import { apiFetch } from '~/utils/fetchers';
import { throwOnParseError } from '~/utils/arktype';
import { createMemo } from 'solid-js';

const useTasksByBoardIdInputSchema = type({
	boardId: 'string',
	enabled: 'boolean = true'
});
const useTasksByBoardIdQueryOptions = ({ boardId }: typeof useTasksByBoardIdInputSchema.infer) =>
	queryOptions({
		enabled: boardId !== undefined,
		queryFn: ({ queryKey }) => {
			const searchParams = new URLSearchParams({
				boardId: String(queryKey[2])
			});
			return apiFetch
				.forwardHeaders()
				.as_json<
					Array<{ subtasks: TTask[] } & TTask>
				>(`/api/v1/private/tasks/by-board?${searchParams.toString()}`);
		},
		queryKey: ['tasks', 'by-board', boardId] as const
	});

function useTasksByBoardId(input: () => typeof useTasksByBoardIdInputSchema.inferIn) {
	const parsedInput = createMemo(() => throwOnParseError(useTasksByBoardIdInputSchema(input())));
	const tasks = createQuery(() => ({
		...useTasksByBoardIdQueryOptions(parsedInput()),
		enabled: parsedInput().enabled && parsedInput().boardId !== undefined
	}));

	return [tasks, {}] as const;
}

const useTaskInputSchema = type({
	'id?': 'string | undefined',
	enabled: 'boolean = true'
});
const useTaskQueryOptions = ({ id }: typeof useTaskInputSchema.infer) =>
	queryOptions({
		enabled: id !== undefined,
		queryFn: ({ queryKey }) => {
			return apiFetch
				.forwardHeaders()
				.as_json<{ subtasks: TTask[] } & TTask>(`/api/v1/private/tasks/${queryKey[1]}`);
		},
		queryKey: ['tasks', id]
	});
function useTask(input: () => typeof useTaskInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useTaskInputSchema(input())));
	const task = createQuery(() => ({
		...useTaskQueryOptions(parsedInput()),
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
			]);
		}
	}));

	return [task, { changeBoard, shiftTask, updateTask, deleteTask }] as const;
}

const useTasksInputSchema = type({
	enabled: 'boolean = true'
});
const useTasksQueryOptions = () =>
	queryOptions({
		queryFn: () =>
			apiFetch
				.forwardHeaders()
				.as_json<Array<{ subtasks: TTask[] } & TTask>>('/api/v1/private/tasks'),
		queryKey: ['tasks']
	});
function useTasks(input: () => typeof useTasksInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useTasksInputSchema(input())));
	const tasks = createQuery(() => ({
		...useTasksQueryOptions(),
		enabled: parsedInput().enabled
	}));

	const createTask = createMutation(() => ({
		mutationFn: (data: Partial<TTask> & { boardId: string }) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ task: TTask }>(`/api/v1/private/tasks`, {
					body: JSON.stringify({ ...data, boardId: data.boardId }),
					method: 'POST'
				});
		},
		onSuccess: () => {
			return Promise.all([
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
			]);
		}
	}));

	const shiftTask = createMutation(() => ({
		mutationFn: (data: { id: string; direction: number }) => {
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
			]);
		}
	}));

	const changeBoard = createMutation(() => ({
		mutationFn: (data: { id: string; boardId: string; index: number }) => {
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
				queryClient.invalidateQueries({ queryKey: ['boards'] }),
				queryClient.invalidateQueries({ queryKey: ['tasks'] })
			]);
		}
	}));

	return [tasks, { changeBoard, shiftTask, createTask }] as const;
}

export { useTasksByBoardId, useTask, useTasks };
