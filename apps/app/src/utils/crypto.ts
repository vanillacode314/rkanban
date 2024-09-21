const encoder = new TextEncoder();
const decoder = new TextDecoder();
const getPasswordKey = (password: string) =>
	crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);

const deriveKey = (passwordKey: CryptoKey, salt: Uint8Array, keyUsage: KeyUsage[]) =>
	crypto.subtle.deriveKey(
		{
			hash: 'SHA-256',
			iterations: 250000,
			name: 'PBKDF2',
			salt
		},
		passwordKey,
		{ length: 256, name: 'AES-GCM' },
		true,
		keyUsage
	);

async function encryptDataWithKey(secretData: string, aesKey: CryptoKey) {
	try {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encryptedContent = await crypto.subtle.encrypt(
			{
				iv: iv,
				name: 'AES-GCM'
			},
			aesKey,
			encoder.encode(secretData)
		);

		const encryptedContentArr = new Uint8Array(encryptedContent);
		const buff = new Uint8Array(iv.byteLength + encryptedContentArr.byteLength);
		buff.set(iv, 0);
		buff.set(encryptedContentArr, iv.byteLength);
		const base64Buff = buf_to_base64(buff);
		return base64Buff;
	} catch (e) {
		console.log(`Error - ${e}`);
		return '';
	}
}

const buf_to_base64 = (buf: Uint8Array) =>
	btoa(String.fromCharCode.apply(null, buf as unknown as number[]));
const base64_to_buf = (b64: string) =>
	Uint8Array.from(atob(b64), (c) => c.charCodeAt(null as unknown as number));

async function decryptDataWithKey(encryptedData: string, aesKey: CryptoKey) {
	try {
		const encryptedDataBuff = base64_to_buf(encryptedData);
		const iv = encryptedDataBuff.slice(0, 12);
		const data = encryptedDataBuff.slice(12);
		const decryptedContent = await crypto.subtle.decrypt(
			{
				iv: iv,
				name: 'AES-GCM'
			},
			aesKey,
			data
		);
		return decoder.decode(decryptedContent);
	} catch (e) {
		console.log(`Error - ${e}`);
		return '';
	}
}

const generateSeedPhrase = async (n: number = 16) => {
	const words = await fetch('/words.txt')
		.then((res) => res.text())
		.then((lines) => lines.split('\n'));

	const seedPhrase: string = Array.from(crypto.getRandomValues(new Uint32Array(n)))
		.map((n) => words[n % words.length])
		.join(' ');
	return seedPhrase;
};

async function encryptKey(key: CryptoKey, encryptionKey: CryptoKey): Promise<string> {
	const passwordKeyString = await exportKey(key);
	return encryptDataWithKey(passwordKeyString, encryptionKey);
}

async function decryptKey(
	encryptedKey: string,
	decryptionKey: CryptoKey,
	keyUsage: KeyUsage[]
): Promise<CryptoKey> {
	const passwordKeyString = await decryptDataWithKey(encryptedKey, decryptionKey);
	return importKey(passwordKeyString, keyUsage);
}

async function importKey(key: string, keyUsage: KeyUsage[]) {
	return crypto.subtle.importKey(
		'jwk',
		JSON.parse(key),
		{ length: 256, name: 'AES-GCM' },
		false,
		keyUsage
	);
}

async function exportKey(key: CryptoKey) {
	return JSON.stringify(await crypto.subtle.exportKey('jwk', key));
}

export {
	base64_to_buf,
	buf_to_base64,
	decryptDataWithKey,
	decryptKey,
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	exportKey,
	generateSeedPhrase,
	getPasswordKey,
	importKey
};
