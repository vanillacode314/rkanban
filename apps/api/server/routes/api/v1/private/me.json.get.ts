import { boards, nodes, tasks } from 'db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);

	const [$nodes, $boards, $tasks] = await Promise.all([
		db
			.select({
				createdAt: nodes.createdAt,
				id: nodes.id,
				name: nodes.name,
				parentId: nodes.parentId,
				updatedAt: nodes.updatedAt
			})
			.from(nodes)
			.where(eq(nodes.userId, user.id)),
		db
			.select({
				createdAt: boards.createdAt,
				id: boards.id,
				index: boards.index,
				nodeId: boards.nodeId,
				title: boards.title,
				updatedAt: boards.updatedAt
			})
			.from(boards)
			.where(eq(boards.userId, user.id)),
		db
			.select({
				boardId: tasks.boardId,
				createdAt: tasks.createdAt,
				id: tasks.id,
				index: tasks.index,
				title: tasks.title,
				updatedAt: tasks.updatedAt
			})
			.from(tasks)
			.where(eq(tasks.userId, user.id))
	]);

	return { boards: $boards, nodes: $nodes, tasks: $tasks };
});
