const encoder = new TextEncoder();
const decoder = new TextDecoder();
const getPasswordKey = (password: string) =>
	window.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);

const deriveKey = (passwordKey: CryptoKey, salt: Uint8Array, keyUsage: KeyUsage[]) =>
	window.crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt,
			iterations: 250000,
			hash: 'SHA-256'
		},
		passwordKey,
		{ name: 'AES-GCM', length: 256 },
		true,
		keyUsage
	);

async function encryptDataWithKey(secretData: string, aesKey: CryptoKey) {
	try {
		const iv = window.crypto.getRandomValues(new Uint8Array(12));
		const encryptedContent = await window.crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: iv
			},
			aesKey,
			encoder.encode(secretData)
		);

		const encryptedContentArr = new Uint8Array(encryptedContent);
		let buff = new Uint8Array(iv.byteLength + encryptedContentArr.byteLength);
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
		const decryptedContent = await window.crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv
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

	const seedPhrase: string = Array.from(window.crypto.getRandomValues(new Uint32Array(n)))
		.map((n) => words[n % words.length])
		.join(' ');
	return seedPhrase;
};

async function encryptKey(key: CryptoKey, encryptionKey: CryptoKey): Promise<string> {
	const passwordKeyString = JSON.stringify(await window.crypto.subtle.exportKey('jwk', key));
	return encryptDataWithKey(passwordKeyString, encryptionKey);
}

async function decryptKey(
	encryptedKey: string,
	decryptionKey: CryptoKey,
	keyUsage: KeyUsage[]
): Promise<CryptoKey> {
	const passwordKeyString = await decryptDataWithKey(encryptedKey, decryptionKey);
	return window.crypto.subtle.importKey(
		'jwk',
		JSON.parse(passwordKeyString),
		{ name: 'AES-GCM', length: 256 },
		false,
		keyUsage
	);
}

export {
	base64_to_buf,
	buf_to_base64,
	decryptDataWithKey,
	decryptKey,
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	generateSeedPhrase,
	getPasswordKey
};
