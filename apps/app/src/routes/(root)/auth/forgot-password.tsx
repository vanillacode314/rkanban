import { createAsync, Navigate, useSearchParams } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRequestEvent } from 'solid-js/web';
import { z } from 'zod';

import { db } from '~/db';
import { forgotPasswordTokens, users } from 'db/schema';
import env from '~/utils/env/server';
import { resend } from '~/utils/resend.server';

const sendResetPasswordEmail = async (email: string) => {
	'use server';
	const result = z.string().email().safeParse(email);
	if (!result.success) {
		return new Error('Invalid Email', {
			cause: 'VALIDATION_ERROR'
		});
	}

	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	if (!user) return new Error('Invalid email', { cause: 'INVALID_EMAIL' });

	const [{ token }] = await db
		.insert(forgotPasswordTokens)
		.values({
			token: nanoid(),
			userId: user.id
		})
		.returning({ token: forgotPasswordTokens.token });
	const event = getRequestEvent()!;
	await resend.emails.send({
		from: env.NOTIFICATIONS_EMAIL_ADDRESS,
		subject: 'Reset Password',
		tags: [
			{
				name: 'category',
				value: 'reset_password'
			}
		],
		text: `Goto this link to reset your password for rkanban: ${new URL(event.request.url).origin}/auth/reset-password?token=${token}
If you did not request a password reset, you can safely ignore this email.`,
		to: [user.email]
	});
};

export default function ForgotPasswordPage() {
	const [searchParams, _setSearchParams] = useSearchParams();
	const email = () => searchParams.email;
	if (!(email() && z.string().email().safeParse(email()).success)) {
		return <Navigate href="/auth/signin" />;
	}

	const result = createAsync(() => sendResetPasswordEmail(email()!));
	result();
	return (
		<p class="grid place-content-center text-xl">
			If your email is registered with us, you should have received an email now.
		</p>
	);
}
