import { json } from '@solidjs/router';
import { APIEvent } from '@solidjs/start/server';
import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { boards, nodes, tasks } from '~/db/schema';
import { getUser } from '~/utils/auth.server';

export async function GET(event: APIEvent) {
	const user = await getUser();
	if (!user) return new Response(null, { status: 401 });

	const [$nodes, $boards, $tasks] = await Promise.all([
		db
			.select({
				id: nodes.id,
				name: nodes.name,
				parentId: nodes.parentId,
				updatedAt: nodes.updatedAt
			})
			.from(nodes)
			.where(eq(nodes.userId, user.id)),
		db
			.select({
				id: boards.id,
				title: boards.title,
				index: boards.index,
				nodeId: boards.nodeId,
				updatedAt: boards.updatedAt
			})
			.from(boards)
			.where(eq(boards.userId, user.id)),
		db
			.select({
				id: tasks.id,
				title: tasks.title,
				index: tasks.index,
				boardId: tasks.boardId,
				updatedAt: tasks.updatedAt
			})
			.from(tasks)
			.where(eq(tasks.userId, user.id))
	]);

	return json({ nodes: $nodes, boards: $boards, tasks: $tasks });
}
