import { action, cache, redirect } from '@solidjs/router';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { RESERVED_PATHS } from '~/consts';
import { db } from '~/db';
import { boards, nodes, tasks, TBoard, TNode, TTask } from '~/db/schema';
import { uniqBy } from '~/utils/array';
import { getUser } from '~/utils/auth.server';
import { createNotifier } from '~/utils/publish';

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

	if (parentPath === '/' && RESERVED_PATHS.includes(parentPath + name)) {
		throw new Error(`custom:/${name} is reserved`);
	}
	const [parentNode] = (await db.all(
		sql.raw(GET_NODES_BY_PATH_QUERY(parentPath, user.id))
	)) as TNode[];
	const [$node] = await db
		.insert(nodes)
		.values({
			id,
			parentId: parentNode.id,
			name: name,
			userId: user.id
		})
		.returning();

	void notify({ type: 'create', id: $node.id, data: $node });

	return $node;
}, 'create-node');

const updateNode = action(async (formData: FormData) => {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

	const id = String(formData.get('id')).trim();
	const name = String(formData.get('name')).trim();
	const parentId = String(formData.get('parentId')).trim();

	const [[rootNode], [currentNode]] = await Promise.all([
		db
			.select({ id: nodes.id })
			.from(nodes)
			.where(and(isNull(nodes.parentId), eq(nodes.userId, user.id))),
		db
			.select({ name: nodes.name, parentId: nodes.parentId })
			.from(nodes)
			.where(and(eq(nodes.id, id), eq(nodes.userId, user.id)))
	]);
	if (!currentNode.name.endsWith('.project') && name.endsWith('.project')) {
		throw new Error(`custom:Cannot rename folder to ${name} ending in .project`);
	}
	if (currentNode.parentId === rootNode.id && RESERVED_PATHS.includes(`/${name}`)) {
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

	void notify({ type: 'update', id: $node.id, data: $node });

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

	void notify({ type: 'delete', id: nodeId });
}, 'delete-node');

async function $copyNode(
	formData: FormData,
	{ shouldNotify = true }: { shouldNotify?: boolean } = {}
) {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');

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
				name:
					duplicateCount > 0 ?
						extension ? `${name} (copy ${duplicateCount}).${extension}`
						:	`${name} (copy ${duplicateCount})`
					:	$node.name,
				id: newNodeId,
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
						title: board.title,
						userId: user.id,
						nodeId: newNodeId
					});
					await Promise.all(
						$tasks
							.filter((task) => task.boardId === board.id)
							.map((task) =>
								tx.insert(tasks).values({
									id: nanoid(),
									index: task.index,
									title: task.title,
									userId: user.id,
									boardId: newBoardId
								})
							)
					);
				})
			);
		}
		return $newNode;
	});

	void notify({ type: 'create', id: $newNode.id, data: $newNode });

	await Promise.all(
		children.map((node) => {
			const formData = new FormData();
			formData.set('id', node.id);
			formData.set('parentId', newNodeId);
			return $copyNode(formData, { shouldNotify: false });
		})
	);
}
const copyNode = action($copyNode, 'copy-node');

function isFolder(node: TNode): boolean {
	return !node.name.endsWith('.project');
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
				// with children
				`UNION ALL
				SELECT 
					* 
				FROM 
					nodes 
				WHERE 
					parentId = (
				    SELECT
				      id
				    FROM
				      CTE
				    WHERE
				      parent_path = __path 
				  )
					`.replace(/__path/g, `'${path}'`)
			:	''
		);
};

const notify = createNotifier('nodes');

export { copyNode, createNode, deleteNode, getNodes, isFolder, updateNode };
