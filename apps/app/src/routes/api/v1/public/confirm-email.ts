import { redirect } from '@solidjs/router';
import { APIEvent } from '@solidjs/start/server';
import { eq } from 'drizzle-orm';
import { deleteCookie } from 'vinxi/http';
import { db } from '~/db';
import { users, verificationTokens } from '~/db/schema';

export const GET = async (event: APIEvent) => {
	'use server';
	const token = new URL(event.request.url).searchParams.get('token');
	if (!token) return new Response('Missing token', { status: 400 });
	const [verificationToken] = await db
		.select({ userId: verificationTokens.userId })
		.from(verificationTokens)
		.where(eq(verificationTokens.token, token));

	if (!verificationToken) return new Response('Invalid token', { status: 400 });

	await db.transaction(async (tx) => {
		const user = await tx
			.update(users)
			.set({ emailVerified: true })
			.where(eq(users.id, verificationToken.userId))
			.returning();
		await tx
			.delete(verificationTokens)
			.where(eq(verificationTokens.userId, verificationToken.userId));
	});

	deleteCookie(event.nativeEvent, 'accessToken');
	return redirect('/');
};
