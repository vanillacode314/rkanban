import { relations } from "drizzle-orm/relations";
import { users, boards, refreshTokens, tasks, verificationTokens } from "./schema";

export const boardsRelations = relations(boards, ({one, many}) => ({
	user: one(users, {
		fields: [boards.userId],
		references: [users.id]
	}),
	tasks: many(tasks),
}));

export const usersRelations = relations(users, ({many}) => ({
	boards: many(boards),
	refreshTokens: many(refreshTokens),
	tasks: many(tasks),
	verificationTokens: many(verificationTokens),
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