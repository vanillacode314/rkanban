import { isServer } from 'solid-js/web';

import { decryptDataWithKey, encryptDataWithKey, importKey } from './crypto';
import { localforage } from './localforage';

async function isEncryptionEnabled() {
	if (isServer) return await isEncryptionEnabledServer();
	return (await localforage.getItem('salt')) !== null;
}

async function isEncryptionEnabledServer() {
	'use server';

	const user = (await getUser({ redirectOnUnauthenticated: true }))!;

	return user.salt !== null;
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
async function decryptWithUserKeys(data: string | undefined): Promise<null | string> {
	if (data === undefined) return null;
	if (isServer) return data;
	const keys = await getUserEncryptionKeys();
	if (keys === null) return data;

	const decryptedData = await decryptDataWithKey(data, keys.privateKey);
	return decryptedData;
}

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
	getUserEncryptionKeys,
	isEncryptionEnabled
};
