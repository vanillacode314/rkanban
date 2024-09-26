import { json } from '@solidjs/router';
import { boards, nodes, tasks } from 'db/schema';
import { eq } from 'drizzle-orm';

import { db } from '~/db';
import { getUser } from '~/utils/auth.server';

export async function GET() {
	const user = await getUser({ shouldThrow: false });
	if (!user) return new Response(null, { status: 401 });

	const [$nodes, $boards, $tasks] = await Promise.all([
		db
			.select({
				createdAt: nodes.createdAt,
				id: nodes.id,
				isDirectory: nodes.isDirectory,
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

	return json({ boards: $boards, nodes: $nodes, tasks: $tasks });
}
