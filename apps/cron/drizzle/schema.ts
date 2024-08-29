import { sqliteTable, AnySQLiteColumn, foreignKey, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const boards = sqliteTable("boards", {
	id: integer("id").primaryKey().notNull(),
	title: text("title").notNull(),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
	userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
});

export const refreshTokens = sqliteTable("refreshTokens", {
	id: integer("id").primaryKey().notNull(),
	userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt").notNull(),
});

export const tasks = sqliteTable("tasks", {
	id: integer("id").primaryKey().notNull(),
	title: text("title").notNull(),
	index: integer("index").notNull(),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
	boardId: integer("boardId").notNull().references(() => boards.id, { onDelete: "cascade" } ),
	userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		indexBoardIdUnique: uniqueIndex("tasks_index_boardId_unique").on(table.index, table.boardId),
	}
});

export const users = sqliteTable("users", {
	id: integer("id").primaryKey().notNull(),
	email: text("email").notNull(),
	passwordHash: text("passwordHash").notNull(),
	emailVerified: integer("emailVerified").default(false),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
},
(table) => {
	return {
		emailUnique: uniqueIndex("users_email_unique").on(table.email),
	}
});

export const verificationTokens = sqliteTable("verificationTokens", {
	id: integer("id").primaryKey().notNull(),
	userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt").notNull(),
});