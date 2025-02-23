import { boards, boardsSchema, nodes, nodesSchema, tasks, tasksSchema } from 'db/schema';
import { z } from 'zod';

const bodySchema = z.object({
	boards: boardsSchema
		.pick({ createdAt: true, id: true, index: true, nodeId: true, title: true })
		.array(),
	nodes: nodesSchema.pick({ createdAt: true, id: true, name: true, parentId: true }).array(),
	tasks: tasksSchema.pick({ boardId: true, createdAt: true, index: true, title: true }).array()
});
export default defineEventHandler(async (event) => {
	const user = await isAuthenticated(event);

	const result = await readValidatedBody(event, bodySchema.safeParse);
	if (!result.success) {
		return new Response(
			JSON.stringify({
				result: { error: result.error.errors, message: 'Invalid request' },
				success: false
			}),
			{
				status: 400
			}
		);
	}

	const data = result.data;

	data.nodes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	data.boards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	data.tasks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

	await db.transaction(async () => {
		if (data.nodes.length > 0) {
			await db.insert(nodes).values(data.nodes.map((node) => ({ ...node, userId: user.id })));
		}
		if (data.boards.length > 0) {
			await db.insert(boards).values(data.boards.map((board) => ({ ...board, userId: user.id })));
		}
		if (data.tasks.length > 0) {
			await db.insert(tasks).values(data.tasks.map((task) => ({ ...task, userId: user.id })));
		}
	});

	return {};
});
