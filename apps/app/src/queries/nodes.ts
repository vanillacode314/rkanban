import { createMutation, createQuery, queryOptions, useQueryClient } from '@tanstack/solid-query';
import { type } from 'arktype';
import { TNode } from 'db/schema';
import { createMemo } from 'solid-js';

import { throwOnParseError } from '~/utils/arktype';
import { apiFetch } from '~/utils/fetchers';

const useNodesByPathInputSchema = type({
	enabled: 'boolean = true',
	includeChildren: 'boolean = false',
	path: 'string'
});
const useNodesByPathQueryOptions = ({
	path,
	includeChildren
}: typeof useNodesByPathInputSchema.infer) =>
	queryOptions({
		queryFn: ({ queryKey }) => {
			const searchParams = new URLSearchParams({
				includeChildren: String(queryKey[3]),
				path: queryKey[2]
			});
			return apiFetch
				.forwardHeaders()
				.as_json<TNode[]>(`/api/v1/private/nodes/by-path?${searchParams.toString()}`);
		},
		queryKey: ['nodes', 'by-path', path, includeChildren] as const
	});
function useNodesByPath(input: () => typeof useNodesByPathInputSchema.inferIn) {
	const parsedInput = createMemo(() => throwOnParseError(useNodesByPathInputSchema(input())));
	const nodes = createQuery(() => ({
		...useNodesByPathQueryOptions(parsedInput()),
		enabled: input().enabled
	}));

	return [nodes, {}] as const;
}

const useNodesInputSchema = type({
	enabled: 'boolean = true'
});
const useNodesQueryOptions = () =>
	queryOptions({
		queryFn: () =>
			apiFetch.forwardHeaders().as_json<{
				children: TNode[];
				node: TNode;
			}>(`/api/v1/private/nodes`),
		queryKey: ['nodes']
	});
function useNodes(input: () => typeof useNodesInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useNodesInputSchema(input())));
	const nodes = createQuery(() => ({ ...useNodesQueryOptions(), enabled: parsedInput().enabled }));

	const createNode = createMutation(() => ({
		mutationFn: (data: { id?: string; name: string; parentId: string }) =>
			apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes`, {
					body: JSON.stringify(data),
					method: 'POST'
				}),
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['nodes'] });
		}
	}));

	const updateNode = createMutation(() => ({
		mutationFn: ({ id, data }: { data: Partial<TNode>; id: string }) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes/${id}`, {
					body: JSON.stringify({ ...data, id }),
					method: 'PUT'
				});
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['nodes'] });
		}
	}));

	const deleteNodes = createMutation(() => ({
		mutationFn: (ids: string[]) =>
			apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes`, {
					method: 'DELETE',
					body: JSON.stringify({ ids })
				}),
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['nodes'] });
		}
	}));

	return [nodes, { deleteNodes, createNode, updateNode }] as const;
}

const useNodeInputSchema = type({
	'id?': 'string | undefined',
	includeChildren: 'boolean = false',
	enabled: 'boolean = true'
});
const useNodeQueryOptions = ({ id, includeChildren }: typeof useNodeInputSchema.infer) =>
	queryOptions({
		enabled: id !== undefined,
		queryFn: ({ queryKey }) => {
			const searchParams = new URLSearchParams({
				includeChildren: String(queryKey[2])
			});
			return apiFetch.forwardHeaders().as_json<{
				children: TNode[];
				node: TNode;
			}>(`/api/v1/private/nodes/${queryKey[1]}?${searchParams.toString()}`);
		},
		queryKey: ['nodes', id, includeChildren]
	});
function useNode(input: () => typeof useNodeInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useNodeInputSchema(input())));
	const node = createQuery(() => ({
		...useNodeQueryOptions(parsedInput()),
		enabled: parsedInput().enabled && parsedInput().id !== undefined
	}));

	const deleteNode = createMutation(() => ({
		mutationFn: () =>
			apiFetch.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes/${input().id}`, {
				method: 'DELETE'
			}),
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['nodes'] });
		}
	}));

	const updateNode = createMutation(() => ({
		mutationFn: (data: Partial<TNode>) => {
			return apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes/${input().id}`, {
					body: JSON.stringify(data),
					method: 'PUT'
				});
		},
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: () => {
			return queryClient.invalidateQueries({ queryKey: ['nodes'] });
		}
	}));
	return [node, { updateNode, deleteNode }] as const;
}

export { useNode, useNodes, useNodesByPath };
