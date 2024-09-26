import { redirect } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import { deleteCookie, getQuery } from 'vinxi/http';

import { db } from '~/db';
import { users, verificationTokens } from 'db/schema';
import { getUser } from '~/utils/auth.server';

export const GET = async () => {
	'use server';
	const token = getQuery().token as string;
	if (!token) return redirect('/');

	const [verificationToken] = await db
		.select({ expiresAt: verificationTokens.expiresAt, userId: verificationTokens.userId })
		.from(verificationTokens)
		.where(eq(verificationTokens.token, token));

	if (!verificationToken) return redirect('/');
	if (verificationToken.expiresAt.getTime() < Date.now()) return redirect('/');

	await db.batch([
		db
			.update(users)
			.set({ emailVerified: true })
			.where(eq(users.id, verificationToken.userId))
			.returning(),
		db.delete(verificationTokens).where(eq(verificationTokens.userId, verificationToken.userId))
	]);

	deleteCookie('accessToken');
	return redirect('/', { revalidate: getUser.key });
};
