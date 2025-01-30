import { nodes, TNode } from 'db/schema';
import { SQL, sql } from 'drizzle-orm';

export const nodesPathCte = (userId: string) =>
	sql`WITH RECURSIVE
    PATH_CTE AS (
      SELECT
        ${nodes.id},
        ${nodes.name} AS path
      FROM
        ${nodes}
      WHERE
        ${nodes.parentId} IS NULL
        AND ${nodes.userId} = ${userId}
      UNION ALL
      SELECT
        n.id,
        path || '/' || n.name
      FROM
        ${nodes} n
        JOIN PATH_CTE ON n.parentId = PATH_CTE.id
    )`;

export async function getNodeByPath(
	path: string,
	userId: string,
	{
		includeChildren = false,
		orderBy = ''
	}: Partial<{ includeChildren: boolean; orderBy: string }> = {}
): Promise<TNode[]> {
	path = path === '/' ? 'root' : 'root' + path;

	const sqlChunks: SQL[] = [
		nodesPathCte(userId),
		sql`SELECT
				  *
				FROM
          ${nodes}
				WHERE
				  id = (
				    SELECT
				      id
				    FROM
				      PATH_CTE
				    WHERE
				      path = ${path}
				  )`
	];

	if (includeChildren) {
		sqlChunks.push(
			sql`UNION ALL
				SELECT 
					* 
				FROM 
          (SELECT * FROM ${nodes} ${sql.raw(orderBy ? `ORDER BY ${orderBy}` : '')})
				WHERE 
					parentId = (
				    SELECT
				      id
				    FROM
				      PATH_CTE
				    WHERE
				      path = ${path}
				  )
					`
		);
	}
	const query = sql.join(sqlChunks, sql.raw(' '));
	return (await db.all(query)) as TNode[];
}

export async function getPathByNodeId(id: string, userId: string) {
	const query = sql`WITH RECURSIVE
        CTE AS (
          SELECT
            1 AS n,
            name,
            parentId,
            name AS path
          FROM
            nodes
          WHERE
            id = ${id}
            AND userId = ${userId}
          UNION ALL
          SELECT
            CTE.n + 1,
            n.name,
            n.parentId,
            n.name || '/' || CTE.path AS path
          FROM
            nodes n
            JOIN CTE ON n.id = CTE.parentId
        )
      SELECT
        '/' || path AS path
      FROM CTE
      ORDER BY
        n DESC
      LIMIT
        1;`;

	const { path } = await db.get<{ path: string }>(query);
	return path === '/root' ? '/' : path.slice('/root'.length);
}
