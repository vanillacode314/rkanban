import { createQueryKeys, mergeQueryKeys } from '@lukemorales/query-key-factory';
import { TBoard, TNode, TTask } from 'db/schema';
import { TAuth } from 'schema';

import { apiFetch } from '~/utils/fetchers';

const tasks = createQueryKeys('tasks', {
	all: {
		queryKey: null,
		queryFn: () => apiFetch.forwardHeaders().as_json<TTask[]>(`/api/v1/private/tasks`)
	},
	byId: ({ id }: { id: string }) => ({
		queryKey: [id],
		queryFn: () => {
			return apiFetch.forwardHeaders().as_json<TTask>(`/api/v1/private/tasks/${id}`);
		}
	}),
	byBoardId: ({ boardId }: { boardId: string }) => ({
		queryKey: [boardId],
		queryFn: () => {
			const searchParams = new URLSearchParams({ boardId });
			return apiFetch
				.forwardHeaders()
				.as_json<TTask[]>(`/api/v1/private/tasks/by-board?${searchParams.toString()}`);
		}
	})
});

const nodes = createQueryKeys('nodes', {
	all: {
		queryKey: null,
		queryFn: () => apiFetch.forwardHeaders().as_json<TNode[]>(`/api/v1/private/nodes`)
	},
	byId: ({ id, includeChildren = false }: { id: string; includeChildren?: boolean }) => ({
		queryKey: [id],
		queryFn: () => {
			const searchParams = new URLSearchParams({ includeChildren: String(includeChildren) });
			return apiFetch
				.forwardHeaders()
				.as_json<TNode[]>(`/api/v1/private/nodes/${id}?${searchParams.toString()}`);
		}
	}),
	byPath: ({ path, includeChildren = false }: { includeChildren?: boolean; path: string }) => ({
		queryKey: [path],
		queryFn: () => {
			const searchParams = new URLSearchParams({
				includeChildren: String(includeChildren),
				path
			});
			return apiFetch
				.forwardHeaders()
				.as_json<TNode[]>(`/api/v1/private/nodes/by-path?${searchParams.toString()}`);
		}
	})
});

const boards = createQueryKeys('boards', {
	all: {
		queryKey: null,
		queryFn: () =>
			apiFetch
				.forwardHeaders()
				.as_json<Array<{ tasks: TTask[] } & TBoard>>(`/api/v1/private/boards`)
	},
	byId: ({ id, includeTasks = false }: { id: string; includeTasks?: boolean }) => ({
		queryKey: [id],
		queryFn: () => {
			const searchParams = new URLSearchParams({
				includeTasks: String(includeTasks)
			});
			return apiFetch
				.forwardHeaders()
				.as_json<
					{ tasks: TTask[] } & TBoard
				>(`/api/v1/private/boards/${id}?${searchParams.toString()}`);
		}
	}),
	byPath: ({ path, includeTasks = false }: { includeTasks?: boolean; path: string }) => ({
		queryKey: [path],
		queryFn: () => {
			const searchParams = new URLSearchParams({
				includeTasks: String(includeTasks),
				path: String(path)
			});
			return apiFetch
				.forwardHeaders()
				.as_json<
					Array<{ tasks: TTask[] } & TBoard>
				>(`/api/v1/private/boards/by-path?${searchParams.toString()}`);
		}
	})
});

const users = createQueryKeys('users', {
	me: {
		queryFn: (): Promise<null | TAuth['user']> =>
			apiFetch
				.forwardHeaders()
				.as_json<null | TAuth>('/api/v1/public/me')
				.then((res) => res?.user ?? null),
		queryKey: null
	}
});

export const queries = mergeQueryKeys(users, boards, nodes, tasks);
