import { InferSelectModel, sql } from 'drizzle-orm';
import { AnySQLiteColumn, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { nanoid } from 'nanoid';

import { ms } from '~/utils/ms';

const refreshTokens = sqliteTable('refreshTokens', {
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	token: text('token').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
});

const verificationTokens = sqliteTable('verificationTokens', {
	expiresAt: integer('expiresAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date(Date.now() + ms('10 min'))),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	token: text('token').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
});

const forgotPasswordTokens = sqliteTable('forgotPasswordTokens', {
	expiresAt: integer('expiresAt', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date(Date.now() + ms('10 min'))),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	token: text('token').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
});

const users = sqliteTable('users', {
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	encryptedPrivateKey: text('encryptedPrivateKey'),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	passwordHash: text('passwordHash').notNull(),
	publicKey: text('publicKey'),
	salt: text('salt'),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch('now'))`)
		.$onUpdateFn(() => new Date())
});

const boards = sqliteTable(
	'boards',
	{
		createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		index: integer('index').notNull(),
		nodeId: text('nodeId')
			.references(() => nodes.id, { onDelete: 'cascade' })
			.notNull(),
		title: text('title').notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`)
			.$onUpdateFn(() => new Date()),
		userId: text('userId')
			.references(() => users.id, { onDelete: 'cascade' })
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
		boardId: text('boardId')
			.references(() => boards.id, { onDelete: 'cascade' })
			.notNull(),
		createdAt: integer('createdAt', { mode: 'timestamp' }).default(sql`(unixepoch('now'))`),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		index: integer('index').notNull(),
		title: text('title').notNull(),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`)
			.$onUpdateFn(() => new Date()),
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
		createdAt: integer('createdAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		isDirectory: integer('isDirectory', { mode: 'boolean' }).notNull(),
		name: text('name').notNull(),
		parentId: text('parentId').references((): AnySQLiteColumn => nodes.id, {
			onDelete: 'cascade'
		}),
		updatedAt: integer('updatedAt', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch('now'))`)
			.$onUpdate(() => new Date()),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => ({
		unq: unique().on(t.name, t.parentId, t.userId)
	})
);

const nodesSchema = createSelectSchema(nodes);
const boardsSchema = createSelectSchema(boards);
const tasksSchema = createSelectSchema(tasks);

type TBoard = InferSelectModel<typeof boards>;
type TTask = InferSelectModel<typeof tasks>;
type TUser = InferSelectModel<typeof users>;
type TNode = InferSelectModel<typeof nodes>;

export {
	boards,
	boardsSchema,
	forgotPasswordTokens,
	nodes,
	nodesSchema,
	refreshTokens,
	tasks,
	tasksSchema,
	users,
	verificationTokens
};
export type { TBoard, TNode, TTask, TUser };
