import { action, cache } from '@solidjs/router';
import { and, eq, like, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { RESERVED_PATHS } from '~/consts';
import { boards, nodes, tasks, TBoard, TNode, TTask } from '~/db/schema';
import { uniqBy } from '~/utils/array';
import { checkUser } from '~/utils/auth.server';
import * as path from '~/utils/path';
import { createNotifier } from '~/utils/publish';

import { db } from './..';

const getNodes = cache(
	async (path: string, { includeChildren = false }: Partial<{ includeChildren: boolean }> = {}) => {
		'use server';

		const user = await checkUser();
		const query = GET_NODES_BY_PATH_QUERY(path, user.id, { includeChildren, orderBy: 'name' });
		const $nodes = (await db.all(sql.raw(query))) as TNode[];
		if ($nodes.length === 0) return new Error(`Not Found`, { cause: 'NOT_FOUND' });
		const node = $nodes.shift()!;
		return { children: $nodes, node };
	},
	'get-nodes'
);

const createNode = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const name = String(formData.get('name')).trim();
	if (!name) throw new Error('name is required');
	const parentPath = String(formData.get('parentPath')).trim();
	if (!parentPath) throw new Error('parentPath is required');
	if (!parentPath.startsWith('/')) throw new Error('parentPath must start with /');
	const id = String(formData.get('id') ?? nanoid()).trim();
	const isDirectory = String(formData.get('isDirectory') ?? 'false') === 'true';

	const fullPath = path.join(parentPath, name);
	if (RESERVED_PATHS.includes(fullPath)) {
		throw new Error(`custom:/${name} is reserved`);
	}

	const rows = await db.all(sql.raw(GET_NODES_BY_PATH_QUERY(fullPath, user.id)));
	if (rows.length > 0) throw new Error(`custom:${fullPath} already exists`);

	const [parentNode] = (await db.all(
		sql.raw(GET_NODES_BY_PATH_QUERY(parentPath, user.id))
	)) as TNode[];
	const [$node] = await db
		.insert(nodes)
		.values({
			id,
			isDirectory,
			name: name,
			parentId: parentNode.id,
			userId: user.id
		})
		.returning();

	void notify({ data: $node, id: $node.id, type: 'create' });

	return $node;
}, 'create-node');

const updateNode = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const id = String(formData.get('id')).trim();
	const name = String(formData.get('name')).trim();
	const parentId = String(formData.get('parentId')).trim();
	let { path: fullPath } = await db.get<{ path: string }>(
		sql.raw(GET_PATH_BY_NODE_ID_QUERY(id, user.id))
	);
	fullPath = path.join(fullPath, '..', name);
	if (RESERVED_PATHS.includes(fullPath)) {
		throw new Error(`custom:/${name} is reserved`);
	}

	const [$node] = await db
		.update(nodes)
		.set({
			name,
			parentId
		})
		.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
		.returning();

	void notify({ data: $node, id: $node.id, type: 'update' });

	return $node;
}, 'update-node');

const deleteNode = action(async (formData: FormData) => {
	'use server';

	const user = await checkUser();

	const nodeId = String(formData.get('id')).trim();

	await db
		.delete(nodes)
		.where(and(eq(nodes.id, nodeId), eq(nodes.userId, user.id)))
		.returning();

	void notify({ id: nodeId, type: 'delete' });
}, 'delete-node');

async function $copyNode(formData: FormData) {
	'use server';

	const user = await checkUser();

	const id = String(formData.get('id')).trim();
	const parentId = String(formData.get('parentId')).trim();

	const [rows, children] = await Promise.all([
		db
			.select()
			.from(nodes)
			.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
			.leftJoin(boards, eq(boards.nodeId, nodes.id))
			.leftJoin(tasks, eq(tasks.boardId, boards.id)),
		db
			.select()
			.from(nodes)
			.where(and(eq(nodes.parentId, id), eq(nodes.userId, user.id)))
	]);
	if (rows.length === 0) throw new Error('Not Found', { cause: 'NOT_FOUND' });

	const $node = rows[0].nodes;
	const $boards = uniqBy(
		rows.map((row) => row.boards).filter(Boolean),
		(board) => board!.id
	) as TBoard[];
	const $tasks = uniqBy(
		rows.map((row) => row.tasks).filter(Boolean),
		(task) => task!.id
	) as TTask[];

	const [name, extension] =
		$node.name.endsWith('.project') ?
			[$node.name.slice(0, -'.project'.length), 'project']
		:	[$node.name, ''];
	const $nodes = await db
		.select()
		.from(nodes)
		.where(
			and(
				or(eq(nodes.name, $node.name), like(nodes.name, `${name}%(copy _)%`)),
				eq(nodes.userId, user.id),
				eq(nodes.parentId, parentId)
			)
		);
	const duplicateCount = $nodes.length;
	const newNodeId = nanoid();
	const $newNode = await db.transaction(async (tx) => {
		const [$newNode] = await tx
			.insert(nodes)
			.values({
				id: newNodeId,
				isDirectory: $node.isDirectory,
				name:
					duplicateCount > 0 ?
						extension ? `${name} (copy ${duplicateCount}).${extension}`
						:	`${name} (copy ${duplicateCount})`
					:	$node.name,
				parentId,
				userId: user.id
			})
			.returning();
		if ($node.name.endsWith('.project')) {
			await Promise.all(
				$boards.map(async (board) => {
					const newBoardId = nanoid();
					await tx.insert(boards).values({
						id: newBoardId,
						index: board.index,
						nodeId: newNodeId,
						title: board.title,
						userId: user.id
					});
					await Promise.all(
						$tasks
							.filter((task) => task.boardId === board.id)
							.map((task) =>
								tx.insert(tasks).values({
									boardId: newBoardId,
									id: nanoid(),
									index: task.index,
									title: task.title,
									userId: user.id
								})
							)
					);
				})
			);
		}
		return $newNode;
	});

	void notify({ data: $newNode, id: $newNode.id, type: 'create' });

	await Promise.all(
		children.map((node) => {
			const formData = new FormData();
			formData.set('id', node.id);
			formData.set('parentId', newNodeId);
			return $copyNode(formData);
		})
	);
}
const copyNode = action($copyNode, 'copy-node');

function isFolder(node: TNode): boolean {
	return !node.isDirectory;
}

const GET_PATH_BY_NODE_ID_QUERY = (id: string, userId: string): string => {
	return `WITH RECURSIVE
        CTE AS (
          SELECT
            1 AS n,
            name,
            parentId,
            name AS path
          FROM
            nodes
          WHERE
            id = __id
            AND userId = __userid
          UNION ALL
          SELECT
            CTE.n + 1,
            n.name,
            n.parentId,
            n.name || '/' || CTE.path AS path
          FROM
            nodes n
            JOIN CTE ON n.id = CTE.parentId
          WHERE
            n.parentId IS NOT NULL
        )
      SELECT
        '/' || path AS path
      FROM CTE
      ORDER BY
        n DESC
      LIMIT
        1;`
		.replace(/__id/g, `'${id}'`)
		.replace(/__userid/g, `'${userId}'`);
};

const GET_NODES_BY_PATH_QUERY = (
	path: string,
	userId: string,
	{
		includeChildren = false,
		orderBy = ''
	}: Partial<{ includeChildren: boolean; orderBy: string }> = {}
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
	  ) SELECT
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
				  ) __includeChildren
	`;

	path = path === '/' ? 'root' : 'root' + path;

	return query
		.replace(/__path/g, `'${path}'`)
		.replace(/__userid/g, `'${userId}'`)
		.replace(
			/__includeChildren/g,
			includeChildren ?
				`UNION ALL
				SELECT 
					* 
				FROM 
          (SELECT * FROM nodes __orderBy)
				WHERE 
					parentId = (
				    SELECT
				      id
				    FROM
				      CTE
				    WHERE
				      parent_path = __path 
				  )
					`
					.replace(/__path/g, `'${path}'`)
					.replace(/__orderBy/g, orderBy === '' ? '' : `ORDER BY ${orderBy}`)
			:	''
		);
};

const notify = createNotifier('nodes');

export { copyNode, createNode, deleteNode, getNodes, isFolder, updateNode };
