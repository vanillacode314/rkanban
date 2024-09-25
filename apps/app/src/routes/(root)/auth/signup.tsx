import { A, action, redirect } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { getRequestEvent } from 'solid-js/web';
import { toast } from 'solid-sonner';
import { setCookie } from 'vinxi/http';
import { z } from 'zod';

import ValidationErrors from '~/components/form/ValidationErrors';
import { Button } from '~/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle
} from '~/components/ui/card';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { Toggle } from '~/components/ui/toggle';
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS, REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '~/consts';
import { passwordSchema } from '~/consts/zod';
import { db } from '~/db';
import { nodes, refreshTokens, users, verificationTokens } from '~/db/schema';
import { onSubmission } from '~/utils/action';
import env from '~/utils/env/server';
import { resend } from '~/utils/resend.server';

const signUpSchema = z
	.object({
		confirmPassword: z.string(),
		email: z.string().email(),
		password: passwordSchema
	})
	.refine((data) => data.password === data.confirmPassword, 'Passwords do not match');
const signUp = action(async (formData: FormData) => {
	'use server';
	const result = signUpSchema.safeParse(Object.fromEntries(formData));
	if (!result.success) {
		return new Error(
			result.error.errors
				.map((error) => `${error.path[0] ?? 'form'};;${error.message}`)
				.join(';;;'),
			{
				cause: 'VALIDATION_ERROR'
			}
		);
	}
	const { email, password } = result.data;

	const passwordHash = await bcrypt.hash(password, 10);

	{
		const [user] = await db.select().from(users).where(eq(users.email, email));
		if (user)
			return new Error('form;;Email already registered. Sign In instead.', {
				cause: 'VALIDATION_ERROR'
			});
	}

	const [user, verificationToken] = await db.transaction(async (tx) => {
		const [user] = await tx.insert(users).values({ email, passwordHash }).returning();
		const [{ token }] = await tx
			.insert(verificationTokens)
			.values({ token: nanoid(), userId: user.id })
			.returning({ token: verificationTokens.token });
		if (!token) {
			tx.rollback();
			return [null, null];
		}
		await tx
			.insert(nodes)
			.values({ isDirectory: true, name: 'root', parentId: null, userId: user.id });
		return [user, token];
	});

	if (!user) return new Error('Database Error', { cause: 'INTERNAL_SERVER_ERROR' });

	const accessToken = jwt.sign({ ...user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS
	});

	const refreshToken = jwt.sign({ ...user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS
	});

	await db.insert(refreshTokens).values({
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000),
		token: refreshToken,
		userId: user.id
	});

	const event = getRequestEvent()!;
	setCookie('accessToken', accessToken, {
		httpOnly: true,
		maxAge: 2 ** 31,
		path: '/',
		sameSite: 'lax',
		secure: true
	});
	setCookie('refreshToken', refreshToken, {
		httpOnly: true,
		maxAge: 2 ** 31,
		path: '/',
		sameSite: 'lax',
		secure: true
	});

	await resend.emails.send({
		from: env.NOTIFICATIONS_EMAIL_ADDRESS,
		subject: 'RKanban - Confirm your email',
		tags: [
			{
				name: 'category',
				value: 'confirm_email'
			}
		],
		text: `Goto this link to confirm your email: ${new URL(event.request.url).origin}/api/v1/public/confirm-email?token=${verificationToken}
If you did not sign up, please ignore this email.`,
		to: [user.email]
	});
	return redirect('/settings');
}, 'signup');

export default function SignUpPage() {
	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const [emailErrors, setEmailErrors] = createStore<string[]>([]);
	const [passwordErrors, setPasswordErrors] = createStore<string[]>([]);
	const [formErrors, setFormErrors] = createStore<string[]>([]);

	onSubmission(
		signUp,
		{
			onError(toastId: number | string | undefined, error) {
				if (!(error instanceof Error)) return;
				switch (error.cause) {
					case 'VALIDATION_ERROR': {
						const validationMap = new Map<string, string[]>();
						for (const message of error.message.split(';;;')) {
							const [path, error] = message.split(';;');
							validationMap.set(path, [...(validationMap.get(path) ?? []), error]);
						}
						setEmailErrors(validationMap.get('email') ?? []);
						setPasswordErrors(validationMap.get('password') ?? []);
						setFormErrors(validationMap.get('form') ?? []);
						toast.error('Invalid Data', { duration: 3000, id: toastId });
						break;
					}
					default:
						console.error(error);
				}
			},
			onPending() {
				setEmailErrors([]);
				setPasswordErrors([]);
				setFormErrors([]);
				return toast.loading('Signing Up..', { duration: Number.POSITIVE_INFINITY });
			},
			onSuccess(_, toastId) {
				toast.success('Account created', { duration: 3000, id: toastId });
			}
		},
		{ always: true }
	);

	return (
		<form action={signUp} class="grid h-full place-content-center" method="post">
			<Card class="w-full max-w-sm">
				<CardHeader>
					<CardTitle class="text-2xl">Sign Up</CardTitle>
					<CardDescription>Enter your details below to create an account.</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-4">
					<ValidationErrors errors={formErrors} />
					<TextField>
						<TextFieldLabel for="email">Email</TextFieldLabel>
						<TextFieldInput
							autocomplete="username"
							autofocus
							id="email"
							name="email"
							placeholder="m@example.com"
							required
							type="email"
						/>
					</TextField>
					<ValidationErrors errors={emailErrors} />
					<TextField>
						<TextFieldLabel for="password">Password</TextFieldLabel>
						<div class="flex gap-2">
							<TextFieldInput
								autocomplete="current-password"
								id="password"
								name="password"
								required
								type={passwordVisible() ? 'text' : 'password'}
							/>
							<Toggle aria-label="toggle password" onChange={(value) => setPasswordVisible(value)}>
								{(state) => (
									<Show
										fallback={<span class="i-heroicons:eye-slash text-lg" />}
										when={state.pressed()}
									>
										<span class="i-heroicons:eye-solid text-lg" />
									</Show>
								)}
							</Toggle>
						</div>
					</TextField>
					<ValidationErrors errors={passwordErrors} />
					<TextField>
						<TextFieldLabel for="confirm-password">Confirm Password</TextFieldLabel>
						<TextFieldInput
							autocomplete="current-password"
							id="confirm-password"
							name="confirmPassword"
							required
							type={passwordVisible() ? 'text' : 'password'}
						/>
					</TextField>
				</CardContent>
				<CardFooter class="grid gap-4 sm:grid-cols-2">
					<Button class="w-full" type="submit">
						Sign Up
					</Button>
					<Button as={A} href="/auth/signin" variant="ghost">
						Sign In Instead
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
