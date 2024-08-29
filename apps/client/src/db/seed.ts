import bcrypt from 'bcrypt';
import { db } from '.';
import { boards, tasks, users } from './schema';

async function seed() {
	await db.transaction(async (tx) => {
		await tx
			.insert(users)
			.values({ id: 1, email: 'test@test.com', passwordHash: bcrypt.hashSync('password', 10) });

		await tx.insert(boards).values([
			{
				id: 1,
				title: 'Board 1',
				userId: 1
			},
			{
				id: 2,
				title: 'Board 2',
				userId: 1
			}
		]);

		await tx.insert(tasks).values([
			{
				id: 1,
				title: 'Task 1',
				boardId: 1,
				userId: 1
			},
			{
				id: 2,
				title: 'Task 2',
				boardId: 1,
				userId: 1
			}
		]);
	});
}

export { seed };
