import { action, cache, redirect } from '@solidjs/router';
import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '~/db';
import { nodes, TNode } from '~/db/schema';
import { getUser } from '~/utils/auth.server';

const getNodes = cache(
	async (path: string, { includeChildren = false }: Partial<{ includeChildren: boolean }> = {}) => {
		'use server';

		const user = await getUser();
		if (!user) throw redirect('/auth/signin');

		const query = GET_NODES_BY_PATH_QUERY(path, user.id, includeChildren);
		const $nodes = (await db.all(sql.raw(query))) as TNode[];
		if ($nodes.length === 0) return new Error(`Not Found`, { cause: 'NOT_FOUND' });
		const node = $nodes.shift()!;
		return { node, children: $nodes };
	},
	'get-nodes'
);

const createNode = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const name = String(formData.get('name')).trim();
	if (!name) throw new Error('name is required');
	const parentPath = String(formData.get('parentPath')).trim();
	if (!parentPath) throw new Error('parentPath is required');
	if (!parentPath.startsWith('/')) throw new Error('parentPath must start with /');
	const id = String(formData.get('id') ?? nanoid()).trim();

	const [parentNode] = (await db.all(
		sql.raw(GET_NODES_BY_PATH_QUERY(parentPath, user.id))
	)) as TNode[];
	const $node = await db
		.insert(nodes)
		.values({
			id,
			parentId: parentNode.id,
			name: name,
			userId: user.id
		})
		.returning();

	return $node;
}, 'create-node');

const updateNode = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const id = String(formData.get('id')).trim();
	const name = String(formData.get('name')).trim();
	const parentId = String(formData.get('parentId')).trim();

	const $node = await db
		.update(nodes)
		.set({
			name,
			parentId
		})
		.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
		.returning();

	return $node;
}, 'update-node');

const deleteNode = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const nodeId = String(formData.get('id')).trim();

	await db
		.delete(nodes)
		.where(and(eq(nodes.id, nodeId), eq(nodes.userId, user.id)))
		.returning();
}, 'delete-node');

function isFolder(node: TNode): boolean {
	return !node.name.includes('.');
}

const GET_NODES_BY_PATH_QUERY = (
	path: string,
	userId: string,
	includeChildren: boolean = false
) => {
	const query = `
	WITH RECURSIVE
	  CTE AS (
	    SELECT
	      id,
	      name AS parent_path
	    FROM
	      nodes
	    WHERE
	      parentId IS NULL
	      AND userId = __userid
	    UNION ALL
	    SELECT
	      n.id,
	      parent_path || '/' || n.name
	    FROM
	      nodes n
	      JOIN CTE ON n.parentId = CTE.id
	  ) __includeChildren
	`;

	path = path === '/' ? 'root' : 'root' + path;

	return query
		.replace(/__path/g, `'${path}'`)
		.replace(/__userid/g, `'${userId}'`)
		.replace(
			/__includeChildren/g,
			includeChildren ?
				// with children
				`
				SELECT
				  *
				FROM
				  nodes
				WHERE
				  id = (
				    SELECT
				      id
				    FROM
				      CTE
				    WHERE
				      parent_path = __path 
				  ) OR parentId = (
				    SELECT
				      id
				    FROM
				      CTE
				    WHERE
				      parent_path = __path 
				  ) 
					`.replace(/__path/g, `'${path}'`)
				// no children
			:	`
				SELECT
				  *
				FROM
				  nodes
				WHERE
				  id = (
				    SELECT
				      id
				    FROM
				      CTE
				    WHERE
				      parent_path = __path 
				  ) 
				`.replace(/__path/g, `'${path}'`)
		);
};

export { createNode, deleteNode, getNodes, isFolder, updateNode };
