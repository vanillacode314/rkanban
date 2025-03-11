import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { type } from 'arktype';
import { TNode } from 'db/schema';
import { create } from 'mutative';
import { createMemo } from 'solid-js';

import { throwOnParseError } from '~/utils/arktype';
import { apiFetch } from '~/utils/fetchers';
import * as path from '~/utils/path';

import { queries } from '.';

const useNodesByPathInputSchema = type({
	enabled: 'boolean = true',
	includeChildren: 'boolean = false',
	path: 'string'
});
function useNodesByPath(input: () => typeof useNodesByPathInputSchema.inferIn) {
	const parsedInput = createMemo(() => throwOnParseError(useNodesByPathInputSchema(input())));
	const nodes = createQuery(() => ({
		...queries.nodes.byPath({
			path: parsedInput().path,
			includeChildren: parsedInput().includeChildren
		}),
		enabled: input().enabled
	}));

	return [nodes, {}] as const;
}

const useNodesInputSchema = type({
	enabled: 'boolean = true'
});
function useNodes(input: () => typeof useNodesInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useNodesInputSchema(input())));
	const nodes = createQuery(() => ({ ...queries.nodes.all, enabled: parsedInput().enabled }));

	const createNode = createMutation(() => ({
		mutationFn: (data: { id?: string; name: string; parentId: string }) =>
			apiFetch
				.appendHeaders({ 'Content-Type': 'application/json' })
				.as_json<{ node: TNode; path: string }>(`/api/v1/private/nodes`, {
					body: JSON.stringify(data),
					method: 'POST'
				}),
		onSuccess: (data) => {
			queryClient.setQueryData<TNode[]>(
				queries.nodes.all.queryKey,
				create((draft) => {
					draft?.push(data.node);
				})
			);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byPath({ path: data.path }), [data.node]);
			queryClient.setQueriesData<TNode[]>(
				queries.nodes.byPath({ path: path.join(data.path, '..') }),
				create((draft) => {
					if (draft === undefined) return;
					draft.push(data.node);
				})
			);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.id }), [data.node]);
			queryClient.setQueriesData<TNode[]>(
				queries.nodes.byId({ id: data.node.parentId! }),
				create((draft) => {
					if (draft === undefined) return;
					draft.push(data.node);
				})
			);
		}
	}));

	const updateNode = createMutation(() => ({
		mutationFn: ({ id, data }: { data: Partial<TNode>; id: string }) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' }).as_json<{
				node: TNode;
				original: {
					node: TNode;
					path: string;
				};
				path: string;
			}>(`/api/v1/private/nodes/${id}`, {
				body: JSON.stringify({ ...data, id }),
				method: 'PUT'
			});
		},
		onSuccess: (data) => {
			const upsert = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) {
					draft.push(data.node);
					return;
				}
				Object.assign(draft[index], data.node);
			});
			const splice = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) return;
				draft.splice(index, 1);
			});
			queryClient.setQueryData<TNode[]>(queries.nodes.all.queryKey, upsert);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byPath({ path: data.path }), [data.node]);
			queryClient.setQueriesData<TNode[]>(
				queries.nodes.byPath({ path: path.join(data.path, '..') }),
				upsert
			);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.id }), [data.node]);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.parentId! }), upsert);
			if (data.original.node.parentId !== data.node.parentId) {
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byId({ id: data.original.node.parentId! }),
					splice
				);
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byPath({ path: path.join(data.original.path, '..') }),
					splice
				);
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byPath({ path: data.original.path }),
					undefined
				);
			}
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
		onSuccess: (data) => {
			const splice = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) return;
				draft.splice(index, 1);
			});
			queryClient.setQueryData<TNode[]>(queries.nodes.all.queryKey, splice);
			queryClient.invalidateQueries({
				queryKey: queries.nodes.byPath._def
			});
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.parentId! }), splice);
		}
	}));

	return [nodes, { deleteNodes, createNode, updateNode }] as const;
}

const useNodeInputSchema = type({
	'id?': 'string | undefined',
	includeChildren: 'boolean = false',
	enabled: 'boolean = true'
});
function useNode(input: () => typeof useNodeInputSchema.inferIn) {
	const queryClient = useQueryClient();
	const parsedInput = createMemo(() => throwOnParseError(useNodeInputSchema(input())));
	const node = createQuery(() => ({
		...queries.nodes.byId({
			id: parsedInput().id!,
			includeChildren: parsedInput().includeChildren
		}),
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
		onSuccess: (data) => {
			const splice = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) return;
				draft.splice(index, 1);
			});
			queryClient.setQueryData<TNode[]>(queries.nodes.all.queryKey, splice);
			queryClient.setQueriesData<TNode[]>(
				queries.nodes.byPath({ path: path.join(data.path, '..') }),
				splice
			);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.parentId! }), splice);
		}
	}));

	const updateNode = createMutation(() => ({
		mutationFn: (data: Partial<TNode>) => {
			return apiFetch.appendHeaders({ 'Content-Type': 'application/json' }).as_json<{
				node: TNode;
				original: {
					node: TNode;
					path: string;
				};
				path: string;
			}>(`/api/v1/private/nodes/${input().id}`, {
				body: JSON.stringify(data),
				method: 'PUT'
			});
		},
		onMutate: () => {
			if (!input().id) throw new Error('No id');
		},
		onSuccess: (data) => {
			const upsert = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) {
					draft.push(data.node);
					return;
				}
				Object.assign(draft[index], data.node);
			});
			const splice = create((draft: TNode[] | undefined) => {
				if (!draft) return;
				const index = draft.findIndex((node) => node.id === data.node.id);
				if (index === -1) return;
				draft.splice(index, 1);
			});
			queryClient.setQueryData<TNode[]>(queries.nodes.all.queryKey, upsert);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byPath({ path: data.path }), [data.node]);
			queryClient.setQueriesData<TNode[]>(
				queries.nodes.byPath({ path: path.join(data.path, '..') }),
				upsert
			);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.id }), [data.node]);
			queryClient.setQueriesData<TNode[]>(queries.nodes.byId({ id: data.node.parentId! }), upsert);
			if (data.original.node.parentId !== data.node.parentId) {
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byId({ id: data.original.node.parentId! }),
					splice
				);
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byPath({ path: path.join(data.original.path, '..') }),
					splice
				);
				queryClient.setQueriesData<TNode[]>(
					queries.nodes.byPath({ path: data.original.path }),
					undefined
				);
			}
		}
	}));
	return [node, { updateNode, deleteNode }] as const;
}

export { useNode, useNodes, useNodesByPath };
