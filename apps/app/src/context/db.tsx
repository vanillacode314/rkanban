import type { SQLocal } from 'sqlocal';

import { CreateQueryResult, queryOptions, SolidQueryOptions } from '@tanstack/solid-query';
import { createContext, createEffect, JSXElement, on, useContext } from 'solid-js';
import { isServer } from 'solid-js/web';

const DBContext = createContext<SQLocal>();

function useDB() {
	const value = useContext(DBContext);
	if (value === undefined) throw new Error('useDB must be used within a DBProvider');
	return value;
}

function DBProvider(props: { children: JSXElement }) {
	let db: SQLocal | undefined = undefined;
	if (!isServer) {
		import('sqlocal').then((module) => {
			db = new module.SQLocal(':memory:');
			seedDb(db);
		});
	}
	return <DBContext.Provider value={db}>{props.children}</DBContext.Provider>;
}

function useTableQueryOptions<T1, T2, T3>(
	tableName: string,
	...args: unknown[]
): SolidQueryOptions<T1, T2, T3, ['tables', string, ...unknown[]]> {
	return queryOptions({
		queryKey: ['tables', tableName, ...args] as const
	});
}

async function seedDb(db: SQLocal) {
	await db.batch((sql) => [
		sql`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parentId TEXT REFERENCES nodes(id) ON DELETE CASCADE
      )
    `,
		sql`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "index" INTEGER NOT NULL,
        nodeId TEXT REFERENCES nodes(id) ON DELETE CASCADE
      )
    `
	]);
}

function syncQueryToDB<T extends CreateQueryResult>(
	query: T,
	fn: (data: Exclude<T['data'], null | undefined>) => void
) {
	createEffect(
		on(
			() => query.data,
			(data) =>
				data !== null && data !== undefined && fn(data as Exclude<T['data'], null | undefined>)
		)
	);
}

export { DBProvider, syncQueryToDB, useDB, useTableQueryOptions };
