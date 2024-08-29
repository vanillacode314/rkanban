import { InferSelectModel, sql } from 'drizzle-orm';
import { AnySQLiteColumn, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

const refreshTokens = sqliteTable('refreshTokens', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull()
});

const verificationTokens = sqliteTable('verificationTokens', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date(Date.now() + 600000))
});

const forgotPasswordTokens = sqliteTable('forgotPasswordTokens', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	token: text('token').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date(Date.now() + 600000))
});

const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	email: text('email').notNull().unique(),
	passwordHash: text('passwordHash').notNull(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.default(sql`(unixepoch('now'))`)
		.$onUpdateFn(() => new Date())
});

const boards = sqliteTable(
	'boards',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		title: text('title').notNull(),
		index: integer('index').notNull(),
		createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.default(sql`(unixepoch('now'))`)
			.$onUpdateFn(() => new Date()),
		userId: text('userId')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull(),
		nodeId: text('nodeId')
			.references(() => nodes.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => {
		return {
			unq: unique().on(table.index, table.userId, table.nodeId)
		};
	}
);

const tasks = sqliteTable(
	'tasks',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		title: text('title').notNull(),
		index: integer('index').notNull(),
		createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.default(sql`(unixepoch('now'))`)
			.$onUpdateFn(() => new Date()),
		boardId: text('boardId')
			.references(() => boards.id, { onDelete: 'cascade' })
			.notNull(),
		userId: text('userId')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => {
		return {
			unq: unique().on(table.index, table.boardId)
		};
	}
);

const nodes = sqliteTable(
	'nodes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		name: text('name').notNull(),
		parentId: text('parentId').references((): AnySQLiteColumn => nodes.id, {
			onDelete: 'cascade'
		}),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: integer('createdAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`)
			.$onUpdate(() => new Date())
	},
	(t) => ({
		unq: unique().on(t.name, t.parentId, t.userId)
	})
);

type TBoard = InferSelectModel<typeof boards>;
type TTask = InferSelectModel<typeof tasks>;
type TUser = InferSelectModel<typeof users>;
type TNode = InferSelectModel<typeof nodes>;

export { boards, forgotPasswordTokens, nodes, refreshTokens, tasks, users, verificationTokens };
export type { TBoard, TNode, TTask, TUser };
