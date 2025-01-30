import { InferSelectModel, sql } from 'drizzle-orm';
import { AnySQLiteColumn, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import { nanoid } from 'nanoid';
import z from 'zod';

const createdAt = () =>
	integer('createdAt', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch('now'))`);

const updatedAt = () =>
	integer('updatedAt', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch('now'))`)
		.$onUpdateFn(() => new Date());

const users = sqliteTable('users', {
	createdAt: createdAt(),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	encryptedPrivateKey: text('encryptedPrivateKey'),
	id: text('id')
		.primaryKey()
		.$defaultFn(() => nanoid()),
	passwordHash: text('passwordHash').notNull(),
	publicKey: text('publicKey'),
	salt: text('salt'),
	updatedAt: updatedAt()
});

const boards = sqliteTable(
	'boards',
	{
		createdAt: createdAt(),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		index: integer('index').notNull(),
		nodeId: text('nodeId')
			.references(() => nodes.id, { onDelete: 'cascade' })
			.notNull(),
		title: text('title').notNull(),
		updatedAt: updatedAt(),
		userId: text('userId')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [unique().on(table.userId, table.nodeId, table.index)]
);

const tasks = sqliteTable(
	'tasks',
	{
		archived: integer('archived', { mode: 'boolean' })
			.notNull()
			.default(sql`0`),
		boardId: text('boardId')
			.references(() => boards.id, { onDelete: 'cascade' })
			.notNull(),
		body: text('body').notNull().default(''),
		createdAt: createdAt(),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		index: integer('index').notNull(),
		tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
		title: text('title').notNull(),
		updatedAt: updatedAt(),
		userId: text('userId')
			.references(() => users.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [unique().on(table.index, table.boardId)]
);

const nodes = sqliteTable(
	'nodes',
	{
		createdAt: createdAt(),
		id: text('id')
			.primaryKey()
			.$defaultFn(() => nanoid()),
		name: text('name').notNull(),
		parentId: text('parentId').references((): AnySQLiteColumn => nodes.id, {
			onDelete: 'cascade'
		}),
		updatedAt: updatedAt(),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(t) => [unique().on(t.userId, t.name, t.parentId)]
);

const nodesSchema = createSelectSchema(nodes, {
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
const boardsSchema = createSelectSchema(boards, {
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
const tasksSchema = createSelectSchema(tasks, {
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});
const usersSchema = createSelectSchema(users, {
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date()
});

type TBoard = InferSelectModel<typeof boards>;
type TTask = InferSelectModel<typeof tasks>;
type TUser = InferSelectModel<typeof users>;
type TNode = InferSelectModel<typeof nodes>;

export { boards, boardsSchema, nodes, nodesSchema, tasks, tasksSchema, users, usersSchema };
export type { TBoard, TNode, TTask, TUser };
