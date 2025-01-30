import { TBoard, TTask } from 'db/schema';
import { SQL, sql } from 'drizzle-orm';

import { nodesPathCte } from './nodes';

export async function getBoardsByPath(
	path: string,
	userId: string,
	{ includeTasks = false }: Partial<{ includeTasks: boolean; orderBy: string }> = {}
): Promise<Array<TBoard & { tasks: TTask[] }>> {
	path = path === '/' ? 'root' : 'root' + path;

	const sqlChunks: SQL[] = [
		nodesPathCte(userId),
		sql`SELECT
          "boards"."id" AS "boards.id",
          "boards"."createdAt" AS "boards.createdAt",
          "boards"."index" AS "boards.index",
          "boards"."nodeId" AS "boards.nodeId",
          "boards"."title" AS "boards.title",
          "boards"."updatedAt" AS "boards.updatedAt",
          "boards"."userId" AS "boards.userId"`
	];
	if (includeTasks) {
		sqlChunks.push(
			sql`,
        "tasks"."id" AS "tasks.id",
        "tasks"."boardId" AS "tasks.boardId",
        "tasks"."userId" AS "tasks.userId",
        "tasks"."index" AS "tasks.index",
        "tasks"."title" AS "tasks.title",
        "tasks"."body" AS "tasks.body",
        "tasks"."createdAt" AS "tasks.createdAt",
        "tasks"."updatedAt" AS "tasks.updatedAt",
        "tasks"."archived" AS "tasks.archived",
        "tasks"."tags" AS "tasks.tags"`
		);
	}

	sqlChunks.push(
		sql`FROM
          boards
        ${sql.raw(includeTasks ? `LEFT JOIN tasks ON "boards.id" = "tasks.boardId"` : '')}
        WHERE
          boards.nodeId = (
            SELECT
              id
            FROM
              PATH_CTE
            WHERE
              path = ${path}
          )
        ORDER BY "boards"."index" ${sql.raw(includeTasks ? ',"tasks"."index"' : '')}`
	);

	const query = sql.join(sqlChunks, sql.raw(' '));
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const rows: any[] = await db.all(query);

	return Array.from(
		rows
			.reduce<Map<string, TBoard & { tasks: TTask[] }>>((acc, row) => {
				if (!acc.has(row['boards.id'])) {
					acc.set(row['boards.id'], {
						createdAt: row['boards.createdAt'],
						id: row['boards.id'],
						index: row['boards.index'],
						nodeId: row['boards.nodeId'],
						tasks: [],
						title: row['boards.title'],
						updatedAt: row['boards.updatedAt'],
						userId: row['boards.userId']
					});
				}

				if (row['tasks.id']) {
					const board = acc.get(row['tasks.boardId']);
					if (!board) throw new Error('Unreachable');

					board.tasks.push({
						archived: row['tasks.archived'],
						boardId: row['tasks.boardId'],
						body: row['tasks.body'],
						createdAt: row['tasks.createdAt'],
						id: row['tasks.id'],
						index: row['tasks.index'],
						tags: JSON.parse(row['tasks.tags']),
						title: row['tasks.title'],
						updatedAt: row['tasks.updatedAt'],
						userId: row['tasks.userId']
					});
				}
				return acc;
			}, new Map())
			.values()
	);
}
