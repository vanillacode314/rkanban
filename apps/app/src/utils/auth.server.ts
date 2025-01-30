import { action, cache, redirect, reload } from '@solidjs/router';
import bcrypt from 'bcryptjs';
import { refreshTokens, TUser, users, verificationTokens } from 'db/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { getRequestEvent, isServer } from 'solid-js/web';
import { deleteCookie, getCookie, setCookie } from 'vinxi/http';

import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from '~/consts';
import { db } from '~/db';

import { decryptDataWithKey, encryptDataWithKey, importKey } from './crypto';
import env from './env/server';
import { localforage } from './localforage';
import { resend } from './resend.server';

// NOTE: only need till the upstream solid-start bug is fixed https://github.com/solidjs/solid-start/issues/1624
async function checkUser() {
	const user = await getUser({ shouldThrow: false });
	//if (!user) throw redirect('/auth/signin');
	return user;
}

const getUser = cache(
	async ({
		redirectOnAuthenticated = false,
		redirectOnUnauthenticated = false,
		shouldThrow = true
	}: Partial<{
		redirectOnAuthenticated: boolean;
		redirectOnUnauthenticated: boolean;
		shouldThrow: boolean;
	}> = {}) => {
		'use server';
		const user = await parseUser();

		//if (!user && redirectOnUnauthenticated) throw redirect('/auth/signin');
		//if (user && redirectOnAuthenticated) throw redirect('/');
		if (!user && shouldThrow) throw new Error('Unauthorized');

		return user;
	},
	'get-user'
);

async function parseUser() {
	'use server';

	const accessToken = getCookie('accessToken');

	try {
		if (accessToken) {
			return jwt.verify(accessToken, env.AUTH_SECRET) as Omit<TUser, 'passwordHash'>;
		} else {
			return parseRefreshAccessToken();
		}
	} catch {
		return parseRefreshAccessToken();
	}
}

async function parseRefreshAccessToken() {
	'use server';

	const refreshToken = getCookie('refreshToken');
	if (!refreshToken) return null;

	let data: jwt.JwtPayload | string;
	try {
		data = jwt.verify(refreshToken, env.AUTH_SECRET) as TUser;
	} catch {
		return null;
	}
	if (!data) {
		return null;
	}
	const [user] = await db
		.select({ id: refreshTokens.userId })
		.from(refreshTokens)
		.where(eq(refreshTokens.token, refreshToken));
	if (!user) {
		return null;
	}
	const [$user] = await db.select().from(users).where(eq(users.id, user.id));
	if (!$user) {
		return null;
	}
	if ($user.salt && $user.salt !== data.salt) {
		return null;
	}
	const accessToken = jwt.sign({ ...$user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS
	});
	setCookie('accessToken', accessToken, {
		httpOnly: true,
		maxAge: 2 ** 31,
		path: '/',
		secure: true
	});
	return $user;
}

async function refreshAccessToken() {
	'use server';

	return reload({ revalidate: getUser.key });
}

async function isEncryptionEnabled() {
	if (isServer) return await isEncryptionEnabledServer();
	return (await localforage.getItem('salt')) !== null;
}

async function isEncryptionEnabledServer() {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;

	return user.salt !== null;
}

async function verifyPassword(password: string): Promise<boolean | Error> {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;

	const [$user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, user.id));

	return await bcrypt.compare(password, $user.passwordHash);
}
const $signOut = async () => {
	'use server';

	const refreshToken = getCookie('refreshToken');
	if (refreshToken) await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
	return redirect('/auth/signin');
};
const signOut = action($signOut, 'sign-out');

async function resendVerificationEmail() {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;

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
		subject: 'Confirm your email',
		tags: [
			{
				name: 'category',
				value: 'confirm_email'
			}
		],
		text: `Goto this link to confirm your email: ${new URL(event.request.url).origin}/api/v1/public/confirm-email?token=${verificationToken}`,
		to: [user.email]
	});
}

async function getUserEncryptionKeys(): Promise<{
	privateKey: CryptoKey;
	publicKey: CryptoKey;
	salt: Uint8Array;
} | null> {
	if (isServer) return null;
	const [$publicKey, $privateKey, salt] = await localforage.getMany<[string, string, Uint8Array]>([
		'publicKey',
		'privateKey',
		'salt'
	]);
	if (!$publicKey || !$privateKey || !salt) {
		const user = await getUser({ shouldThrow: false });
		if (!user) return null;
		if (user.salt === null) return null;
		$signOut();
		return null;
	}
	const [publicKey, privateKey] = await Promise.all([
		importKey($publicKey, ['encrypt']),
		importKey($privateKey, ['decrypt'])
	]);
	return { privateKey, publicKey, salt };
}

async function encryptWithUserKeys(data: string) {
	if (isServer) return data;
	const keys = await getUserEncryptionKeys();
	if (keys === null) return data;

	const encryptedData = await encryptDataWithKey(data, keys.publicKey);
	return encryptedData;
}

async function decryptWithUserKeys(data: undefined): Promise<null>;
async function decryptWithUserKeys(data: string): Promise<string>;
async function decryptWithUserKeys(data: string | undefined): Promise<null | string>;
async function decryptWithUserKeys(data: string | undefined) {
	if (data === undefined) return null;
	if (isServer) return data;
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
	checkUser,
	decryptObjectKeys,
	decryptWithUserKeys,
	encryptWithUserKeys,
	getUser,
	getUserEncryptionKeys,
	isEncryptionEnabled,
	refreshAccessToken,
	resendVerificationEmail,
	signOut,
	verifyPassword
};
