import { relations } from "drizzle-orm/relations";
import { nodes, boards, users, forgotPasswordTokens, refreshTokens, tasks, verificationTokens } from "./schema";

export const boardsRelations = relations(boards, ({one, many}) => ({
	node: one(nodes, {
		fields: [boards.nodeId],
		references: [nodes.id]
	}),
	user: one(users, {
		fields: [boards.userId],
		references: [users.id]
	}),
	tasks: many(tasks),
}));

export const nodesRelations = relations(nodes, ({one, many}) => ({
	boards: many(boards),
	user: one(users, {
		fields: [nodes.userId],
		references: [users.id]
	}),
	node: one(nodes, {
		fields: [nodes.parentId],
		references: [nodes.id],
		relationName: "nodes_parentId_nodes_id"
	}),
	nodes: many(nodes, {
		relationName: "nodes_parentId_nodes_id"
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	boards: many(boards),
	forgotPasswordTokens: many(forgotPasswordTokens),
	nodes: many(nodes),
	refreshTokens: many(refreshTokens),
	tasks: many(tasks),
	verificationTokens: many(verificationTokens),
}));

export const forgotPasswordTokensRelations = relations(forgotPasswordTokens, ({one}) => ({
	user: one(users, {
		fields: [forgotPasswordTokens.userId],
		references: [users.id]
	}),
}));

export const refreshTokensRelations = relations(refreshTokens, ({one}) => ({
	user: one(users, {
		fields: [refreshTokens.userId],
		references: [users.id]
	}),
}));

export const tasksRelations = relations(tasks, ({one}) => ({
	user: one(users, {
		fields: [tasks.userId],
		references: [users.id]
	}),
	board: one(boards, {
		fields: [tasks.boardId],
		references: [boards.id]
	}),
}));

export const verificationTokensRelations = relations(verificationTokens, ({one}) => ({
	user: one(users, {
		fields: [verificationTokens.userId],
		references: [users.id]
	}),
}));