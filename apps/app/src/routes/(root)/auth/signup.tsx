import { A, action, redirect, useSubmission } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { Show, createEffect, createSignal, untrack } from 'solid-js';
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
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '~/consts';
import { passwordSchema } from '~/consts/zod';
import { db } from '~/db';
import { nodes, refreshTokens, users, verificationTokens } from '~/db/schema';
import env from '~/utils/env/server';
import { resend } from '~/utils/resend.server';

const signUpSchema = z
	.object({
		email: z.string().email(),
		password: passwordSchema,
		confirmPassword: z.string()
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
		await tx.insert(nodes).values({ name: 'root', parentId: null, userId: user.id });
		return [user, token];
	});

	if (!user) return new Error('Database Error', { cause: 'INTERNAL_SERVER_ERROR' });

	const accessToken = jwt.sign({ ...user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN
	});

	const refreshToken = jwt.sign({ ...user, passwordHash: undefined }, env.AUTH_SECRET, {
		expiresIn: REFRESH_TOKEN_EXPIRES_IN_SECONDS
	});

	await db.insert(refreshTokens).values({
		userId: user.id,
		token: refreshToken,
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000)
	});

	const event = getRequestEvent()!;
	setCookie('accessToken', accessToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});
	setCookie('refreshToken', refreshToken, {
		httpOnly: true,
		secure: true,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});

	await resend.emails.send({
		from: env.NOTIFICATIONS_EMAIL_ADDRESS,
		to: [user.email],
		subject: 'Confirm your email',
		text: `Goto this link to confirm your email: ${new URL(event.request.url).origin}/api/v1/public/confirm-email?token=${verificationToken}
If you did not sign up, please ignore this email.`,
		tags: [
			{
				name: 'category',
				value: 'confirm_email'
			}
		]
	});
	return redirect('/settings');
}, 'signup');

export default function SignUpPage() {
	const submission = useSubmission(signUp);

	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const [emailErrors, setEmailErrors] = createStore<string[]>([]);
	const [passwordErrors, setPasswordErrors] = createStore<string[]>([]);
	const [formErrors, setFormErrors] = createStore<string[]>([]);

	let toastId: string | number | undefined;
	createEffect(() => {
		const { result, pending } = submission;
		return untrack(() => {
			setEmailErrors([]);
			setPasswordErrors([]);
			setFormErrors([]);
			if (pending) {
				if (toastId) toast.dismiss(toastId);
				toastId = toast.loading('Creating account...', { duration: Number.POSITIVE_INFINITY });
				return toastId;
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
					default:
						console.error(result);
				}
			} else {
				toast.success('Account created', { id: toastId, duration: 3000 });
			}
			toastId = undefined;
		});
	});

	/* onMount(async () => {
		const seedPhrase = await generateSeedPhrase();
		const derivationKey = await getPasswordKey(seedPhrase);
		const salt = window.crypto.getRandomValues(new Uint8Array(16));
		const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
		const publicKey = await deriveKey(derivationKey, salt, ['encrypt']);
		const password = 'test';
		const derivationKey2 = await getPasswordKey(password);
		const publicKey2 = await deriveKey(derivationKey2, salt, ['encrypt']);
		const privateKey2 = await deriveKey(derivationKey2, salt, ['decrypt']);
		const encryptedPrivateKey = await encryptKey(privateKey, publicKey2);
	}); */

	return (
		<form class="grid h-full place-content-center" action={signUp} method="post">
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
						<TextFieldLabel for="password">Password</TextFieldLabel>
						<div class="flex gap-2">
							<TextFieldInput
								name="password"
								id="password"
								type={passwordVisible() ? 'text' : 'password'}
								required
								autocomplete="current-password"
							/>
							<Toggle aria-label="toggle password" onChange={(value) => setPasswordVisible(value)}>
								{(state) => (
									<Show
										when={state.pressed()}
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
				<CardFooter class="grid gap-4 sm:grid-cols-2">
					<Button type="submit" class="w-full">
						Sign Up
					</Button>
					<Button variant="ghost" href="/auth/signin" as={A}>
						Sign In Instead
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
