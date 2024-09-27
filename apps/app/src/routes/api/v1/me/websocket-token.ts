import jwt from 'jsonwebtoken';
import { setCookie } from 'vinxi/http';

import { checkUser } from '~/utils/auth.server';
import env from '~/utils/env/server';
import { ms } from '~/utils/ms';

export async function GET() {
	const user = await checkUser();

	const token = jwt.sign({ id: user.id }, env.AUTH_SECRET, {
		expiresIn: ms('1 day') / 1000
	});

	setCookie('websocketToken', token, { httpOnly: true, path: '/', secure: import.meta.env.PROD });
	return token;
}
