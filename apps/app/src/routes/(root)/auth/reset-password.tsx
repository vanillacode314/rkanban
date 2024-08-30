import { A, action, redirect, useNavigate, useSearchParams, useSubmission } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { Show, createEffect, createSignal, untrack } from 'solid-js';
import { getRequestEvent } from 'solid-js/web';
import { toast } from 'solid-sonner';
import { setCookie } from 'vinxi/http';
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
import { db } from '~/db';
import { forgotPasswordTokens, refreshTokens, users } from '~/db/schema';

import { createStore } from 'solid-js/store';
import { z } from 'zod';
import ValidationErrors from '~/components/form/ValidationErrors';
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '~/consts';
import { passwordSchema } from '~/consts/zod';

const resetPasswordSchema = z
	.object({
		email: z.string({ required_error: 'Email is required' }).email(),
		password: passwordSchema,
		confirmPassword: z.string(),
		token: z.string({ required_error: 'Token is required' })
	})
	.refine((data) => data.password === data.confirmPassword, 'Passwords do not match');
const resetPassword = action(async (formData: FormData) => {
	'use server';
	const result = resetPasswordSchema.safeParse(Object.fromEntries(formData));
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
	const { token, email, password, confirmPassword } = result.data;

	const [$token] = await db
		.select()
		.from(forgotPasswordTokens)
		.where(eq(forgotPasswordTokens.token, token));

	if (!$token) return new Error('Invalid token', { cause: 'INVALID_TOKEN' });

	const [user] = await db.select().from(users).where(eq(users.id, $token.userId)).limit(1);

	if (user.email !== email) return new Error('Invalid email', { cause: 'INVALID_EMAIL' });

	const passwordHash = await bcrypt.hash(password, 10);

	await db.transaction(async (tx) => {
		await tx.update(users).set({ passwordHash }).where(eq(users.email, email)).returning();
		await tx.delete(forgotPasswordTokens).where(eq(forgotPasswordTokens.userId, user.id));
	});

	const accessToken = jwt.sign({ ...user, passwordHash: undefined }, process.env.AUTH_SECRET!, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN
	});

	const refreshToken = jwt.sign({}, process.env.AUTH_SECRET!, {
		expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS
	});

	await db.insert(refreshTokens).values({
		userId: user.id,
		token: refreshToken,
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000)
	});

	const event = getRequestEvent()!;
	setCookie(event.nativeEvent, 'accessToken', accessToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});
	setCookie(event.nativeEvent, 'refreshToken', refreshToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});
	return redirect('/');
}, 'signin');

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [searchParams, _setSearchParams] = useSearchParams();
	const token = () => searchParams.token;

	const submission = useSubmission(resetPassword);
	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const [emailErrors, setEmailErrors] = createStore<string[]>([]);
	const [passwordErrors, setPasswordErrors] = createStore<string[]>([]);
	const [formErrors, setFormErrors] = createStore<string[]>([]);

	let toastId: string | number | undefined;
	createEffect(() => {
		const { result, pending } = submission;

		untrack(() => {
			if (pending) {
				if (toastId) toast.dismiss(toastId);
				toastId = toast.loading('Logging in...', { duration: Number.POSITIVE_INFINITY });
				return;
			}
			if (!result) return;
			if (result instanceof Error) {
				switch (result.cause) {
					case 'VALIDATION_ERROR':
						const validationMap = new Map<string, string[]>();
						for (const message of result.message.split(';;;')) {
							const [path, error] = message.split(';;');
							validationMap.set(path, [...(validationMap.get(path) ?? []), error]);
						}
						setEmailErrors(validationMap.get('email') ?? []);
						setPasswordErrors(validationMap.get('password') ?? []);
						setFormErrors(validationMap.get('form') ?? []);
						toast.error('Invalid Data', { id: toastId, duration: 3000 });
						break;
					case 'INVALID_TOKEN':
						toast.error('Invalid Token', {
							action: {
								label: 'Go to sign in page',
								onClick() {
									navigate('/auth/signin');
								}
							}
						});
						break;
					case 'INVALID_EMAIL':
						toast.error('Invalid Email', { id: toastId, duration: 3000 });
						break;
					default:
						console.error(result);
				}
			} else {
				toast.success('Login successful', { id: toastId, duration: 3000 });
			}
			toastId = undefined;
		});
	});

	return (
		<Show
			when={token()}
			fallback={
				<div class="grid w-full place-content-center place-items-center gap-4 p-5">
					<p>Invalid token</p>
					<Button class="w-full" href="/" as={A}>
						Go to home page
					</Button>
				</div>
			}
		>
			<form class="grid h-full place-content-center" action={resetPassword} method="post">
				<Card class="w-full max-w-sm">
					<CardHeader>
						<CardTitle class="text-2xl">Reset Password</CardTitle>
						<CardDescription>Create a new password</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-4">
						<input type="hidden" name="token" value={token()} />
						<ValidationErrors errors={formErrors} />
						<TextField>
							<TextFieldLabel for="email">Email</TextFieldLabel>
							<TextFieldInput
								autofocus
								id="email"
								type="email"
								name="email"
								placeholder="m@example.com"
								required
								autocomplete="username"
							/>
						</TextField>
						<ValidationErrors errors={emailErrors} />
						<TextField>
							<TextFieldLabel for="password">New Password</TextFieldLabel>
							<div class="flex gap-2">
								<TextFieldInput
									name="password"
									id="password"
									type={passwordVisible() ? 'text' : 'password'}
									required
									autocomplete="current-password"
								/>
								<Toggle
									aria-label="toggle password"
									onChange={(value) => setPasswordVisible(value)}
								>
									{() => (
										<Show
											when={passwordVisible()}
											fallback={<span class="i-heroicons:eye-slash text-lg"></span>}
										>
											<span class="i-heroicons:eye-solid text-lg"></span>
										</Show>
									)}
								</Toggle>
							</div>
						</TextField>
						<ValidationErrors errors={passwordErrors} />
						<TextField>
							<TextFieldLabel for="confirm-password">Confirm Password</TextFieldLabel>
							<TextFieldInput
								name="confirmPassword"
								id="confirm-password"
								type={passwordVisible() ? 'text' : 'password'}
								required
								autocomplete="current-password"
							/>
						</TextField>
					</CardContent>
					<CardFooter>
						<Button type="submit" class="w-full">
							Reset Password
						</Button>
					</CardFooter>
				</Card>
			</form>
		</Show>
	);
}
