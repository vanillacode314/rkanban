'use server';
import { cache, redirect, reload } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getRequestEvent } from 'solid-js/web';
import { deleteCookie, getCookie, setCookie } from 'vinxi/http';
import { db } from '~/db';
import { TUser, refreshTokens, users, verificationTokens } from '~/db/schema';
import { resend } from './resend.server';

const getUser = cache(async (shouldBeAuthenticated: boolean | null = true) => {
	const user = await parseUser();
	if (shouldBeAuthenticated === null) return user;
	if (!user && shouldBeAuthenticated) return redirect('/auth/signin');
	if (user && !shouldBeAuthenticated) return redirect('/');
	return user;
}, 'get-user');

async function parseUser() {
	const accessToken = getCookie('accessToken');

	try {
		if (accessToken) {
			return jwt.verify(accessToken, process.env.AUTH_SECRET!) as Omit<TUser, 'passwordHash'>;
		} else {
			return parseRefreshAccessToken();
		}
	} catch (err) {
		return parseRefreshAccessToken();
	}
}

async function parseRefreshAccessToken() {
	const refreshToken = getCookie('refreshToken');
	if (!refreshToken) return null;

	let data: string | jwt.JwtPayload;
	try {
		data = jwt.verify(refreshToken, process.env.AUTH_SECRET!);
	} catch {
		return null;
	}
	if (!data) return null;
	const [user] = await db
		.select({ id: refreshTokens.userId })
		.from(refreshTokens)
		.where(eq(refreshTokens.token, refreshToken));
	if (!user) return null;
	const [$user] = await db.select().from(users).where(eq(users.id, user.id));
	if (!$user) {
		return null;
	}
	const accessToken = jwt.sign({ ...$user, passwordHash: undefined }, process.env.AUTH_SECRET!, {
		expiresIn: '1h'
	});
	setCookie('accessToken', accessToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 3600
	});
	return $user;
}

async function refreshAccessToken() {
	deleteCookie('accessToken');
	return reload({ revalidate: getUser.key });
}

async function resendVerificationEmail() {
	const user = await getUser();
	if (!user) throw new Error('Unauthorized');
	const event = getRequestEvent()!;

	const verificationToken = await db.transaction(async (tx) => {
		await tx.delete(verificationTokens).where(eq(verificationTokens.userId, user.id));
		const [{ token }] = await tx
			.insert(verificationTokens)
			.values({ token: nanoid(), userId: user.id })
			.returning({ token: verificationTokens.token });
		if (!token) return new Error('Database Error');
		return token;
	});

	if (verificationToken instanceof Error) throw verificationToken;

	await resend.emails.send({
		from: 'justkanban <no-reply@notifications.raqueeb.com>',
		to: [user.email],
		subject: 'Confirm your email',
		text: `Goto this link to confirm your email: ${new URL(event.request.url).origin}/api/public/confirm-email?token=${verificationToken}`,
		tags: [
			{
				name: 'category',
				value: 'confirm_email'
			}
		]
	});
}

export { getUser, refreshAccessToken, resendVerificationEmail };
