import { action, cache, redirect, reload } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getRequestEvent, isServer } from 'solid-js/web';
import { deleteCookie, getCookie, getRequestURL, setCookie } from 'vinxi/http';
import { db } from '~/db';
import { TUser, refreshTokens, users, verificationTokens } from '~/db/schema';
import { ACCESS_TOKEN_EXPIRES_IN } from '../consts';
import { decryptDataWithKey, encryptDataWithKey, importKey } from './crypto';
import env from './env/server';
import { idb } from './idb';
import { resend } from './resend.server';

const getUser = cache(async (shouldBeAuthenticated: boolean | null = true) => {
	'use server';

	const url = getRequestURL();
	const user = await parseUser();
	if (shouldBeAuthenticated === null) return user;
	if (!user && shouldBeAuthenticated) {
		console.log(`Unauthorized: redirecting to /auth/signin from ${url.pathname}`);
		throw redirect('/auth/signin');
	}
	if (user && !shouldBeAuthenticated) {
		console.log(`Authorized: redirecting to / from ${url.pathname}`);
		throw redirect('/');
	}
	return user;
}, 'get-user');

async function parseUser() {
	'use server';

	const accessToken = getCookie('accessToken');

	try {
		if (accessToken) {
			return jwt.verify(accessToken, env.AUTH_SECRET) as Omit<TUser, 'passwordHash'>;
		} else {
			return parseRefreshAccessToken();
		}
	} catch (err) {
		return parseRefreshAccessToken();
	}
}

async function parseRefreshAccessToken() {
	'use server';

	const refreshToken = getCookie('refreshToken');
	if (!refreshToken) return null;

	let data: string | jwt.JwtPayload;
	try {
		data = jwt.verify(refreshToken, env.AUTH_SECRET) as TUser;
	} catch {
		deleteCookie('refreshToken');
		return null;
	}
	if (!data) {
		deleteCookie('refreshToken');
		return null;
	}
	const [user] = await db
		.select({ id: refreshTokens.userId })
		.from(refreshTokens)
		.where(eq(refreshTokens.token, refreshToken));
	if (!user) {
		deleteCookie('refreshToken');
		return null;
	}
	const [$user] = await db.select().from(users).where(eq(users.id, user.id));
	if (!$user) {
		deleteCookie('refreshToken');
		return null;
	}
	if ($user.salt && $user.salt !== data.salt) {
		deleteCookie('refreshToken');
		return null;
	}
	const accessToken = jwt.sign({ ...$user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN
	});
	setCookie('accessToken', accessToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 2 ** 31
	});
	return $user;
}

async function refreshAccessToken() {
	'use server';

	deleteCookie('accessToken');
	return reload({ revalidate: getUser.key });
}

async function verifyPassword(password: string): Promise<boolean | Error> {
	'use server';

	const user = await getUser();
	if (!user) return new Error('Unauthorized');
	const [$user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, user.id));
	return await bcrypt.compare(password, $user.passwordHash);
}
const $signOut = async () => {
	'use server';

	deleteCookie('accessToken');
	const refreshToken = getCookie('refreshToken');
	deleteCookie('refreshToken');
	if (refreshToken) await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
	return redirect('/auth/signin');
};
const signOut = action($signOut, 'sign-out');

async function resendVerificationEmail() {
	'use server';

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
		from: env.NOTIFICATIONS_EMAIL_ADDRESS,
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

async function getUserEncryptionKeys(): Promise<{
	publicKey: CryptoKey;
	privateKey: CryptoKey;
	salt: Uint8Array;
} | null> {
	if (isServer) return null;
	const [$publicKey, $privateKey, salt] = await idb.getMany(['publicKey', 'privateKey', 'salt']);
	if (!$publicKey || !$privateKey || !salt) {
		const user = await getUser();
		if (!user) return null;
		if (user.salt === null) return null;
		$signOut();
		return null;
	}
	const [publicKey, privateKey] = await Promise.all([
		importKey($publicKey, ['encrypt']),
		importKey($privateKey, ['decrypt'])
	]);
	return { publicKey, privateKey, salt };
}

async function encryptWithUserKeys(data: string) {
	const keys = await getUserEncryptionKeys();
	if (keys === null) return data;

	const encryptedData = await encryptDataWithKey(data, keys.publicKey);
	return encryptedData;
}

async function decryptWithUserKeys(data: string) {
	const keys = await getUserEncryptionKeys();
	if (keys === null) return data;

	const decryptedData = await decryptDataWithKey(data, keys.privateKey);
	return decryptedData;
}

async function decryptObjectKeys<T extends Record<string, unknown>>(
	objs: T,
	keys: Array<keyof T>
): Promise<T>;
async function decryptObjectKeys<T extends Record<string, unknown>>(
	objs: T[],
	keys: Array<keyof T>
): Promise<T[]>;
async function decryptObjectKeys<T extends Record<string, unknown>>(
	objs: T,
	keys: Array<keyof T>
): Promise<T>;
async function decryptObjectKeys<T extends Record<string, unknown>>(
	objs: T | T[],
	keys: Array<keyof T>
): Promise<T | T[]> {
	if (keys.length === 0) throw new Error('No keys provided');

	const wasOriginallyArray = Array.isArray(objs);
	if (!Array.isArray(objs)) objs = [objs];

	await Promise.all(
		objs.flatMap((obj) =>
			keys.map(async (key) => {
				obj[key] = (await decryptWithUserKeys(obj[key] as string)) as T[keyof T];
			})
		)
	);
	return wasOriginallyArray ? objs : objs[0];
}

export {
	decryptObjectKeys,
	decryptWithUserKeys,
	encryptWithUserKeys,
	getUser,
	getUserEncryptionKeys,
	refreshAccessToken,
	resendVerificationEmail,
	signOut,
	verifyPassword
};
