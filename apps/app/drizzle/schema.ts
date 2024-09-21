import { sqliteTable, AnySQLiteColumn, uniqueIndex, foreignKey, text, integer } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const boards = sqliteTable("boards", {
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	index: integer("index").notNull(),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	nodeId: text("nodeId").notNull().references(() => nodes.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		indexUserIdNodeIdUnique: uniqueIndex("boards_index_userId_nodeId_unique").on(table.index, table.userId, table.nodeId),
	}
});

export const forgotPasswordTokens = sqliteTable("forgotPasswordTokens", {
	id: text("id").primaryKey().notNull(),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt").notNull(),
});

export const nodes = sqliteTable("nodes", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	parentId: text("parentId"),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`).notNull(),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`).notNull(),
	isDirectory: integer("isDirectory"),
},
(table) => {
	return {
		nameParentIdUserIdUnique: uniqueIndex("nodes_name_parentId_userId_unique").on(table.name, table.parentId, table.userId),
		nodesParentIdNodesIdFk: foreignKey(() => ({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "nodes_parentId_nodes_id_fk"
		})).onDelete("cascade"),
	}
});

export const refreshTokens = sqliteTable("refreshTokens", {
	id: text("id").primaryKey().notNull(),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt").notNull(),
});

export const tasks = sqliteTable("tasks", {
	id: text("id").primaryKey().notNull(),
	title: text("title").notNull(),
	index: integer("index").notNull(),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
	boardId: text("boardId").notNull().references(() => boards.id, { onDelete: "cascade" } ),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
},
(table) => {
	return {
		indexBoardIdUnique: uniqueIndex("tasks_index_boardId_unique").on(table.index, table.boardId),
	}
});

export const users = sqliteTable("users", {
	id: text("id").primaryKey().notNull(),
	email: text("email").notNull(),
	passwordHash: text("passwordHash").notNull(),
	emailVerified: integer("emailVerified").default(false),
	publicKey: text("publicKey"),
	encryptedPrivateKey: text("encryptedPrivateKey"),
	salt: text("salt"),
	createdAt: integer("createdAt").default(sql`(unixepoch('now'))`),
	updatedAt: integer("updatedAt").default(sql`(unixepoch('now'))`),
},
(table) => {
	return {
		emailUnique: uniqueIndex("users_email_unique").on(table.email),
	}
});

export const verificationTokens = sqliteTable("verificationTokens", {
	id: text("id").primaryKey().notNull(),
	userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" } ),
	token: text("token").notNull(),
	expiresAt: integer("expiresAt").notNull(),
});