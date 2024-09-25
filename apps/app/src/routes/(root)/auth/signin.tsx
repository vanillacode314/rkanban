import { A, action, revalidate, useAction, useNavigate } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createSignal, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
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
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS, REFRESH_TOKEN_EXPIRES_IN_SECONDS } from '~/consts/index';
import { db } from '~/db';
import { refreshTokens, users } from '~/db/schema';
import { onSubmission } from '~/utils/action';
import { getUser } from '~/utils/auth.server';
import { decryptDataWithKey, deriveKey, getPasswordKey } from '~/utils/crypto';
import env from '~/utils/env/server';
import { localforage } from '~/utils/localforage';

const signInSchema = z.object({
	email: z.string().email(),
	password: z.string()
});
const signIn = action(async (formData: FormData) => {
	'use server';
	const result = signInSchema.safeParse(Object.fromEntries(formData));
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

	const [user] = await db.select().from(users).where(eq(users.email, email));

	if (!user) return new Error('form;;Email or password incorrect', { cause: 'VALIDATION_ERROR' });

	if (!(await bcrypt.compare(password, user.passwordHash)))
		return new Error('form;;Email or password incorrect', { cause: 'VALIDATION_ERROR' });

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

	setCookie('accessToken', accessToken, {
		httpOnly: true,
		maxAge: 2 ** 31,
		path: '/',
		sameSite: 'lax',
		secure: import.meta.env.PROD
	});
	setCookie('refreshToken', refreshToken, {
		httpOnly: true,
		maxAge: 2 ** 31,
		path: '/',
		sameSite: 'lax',
		secure: import.meta.env.PROD
	});
	return { ...user, passwordHash: undefined };
}, 'signin');

export default function SignInPage() {
	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const $signIn = useAction(signIn);
	const [email, setEmail] = createSignal('');
	const navigate = useNavigate();
	const [formErrors, setFormErrors] = createStore<string[]>([]);

	onSubmission(
		signIn,
		{
			onError(toastId: number | string | undefined, error) {
				if (error instanceof Error) {
					switch (error.cause) {
						case 'VALIDATION_ERROR': {
							const validationMap = new Map<string, string[]>();
							for (const message of error.message.split(';;;')) {
								const [path, error] = message.split(';;');
								validationMap.set(path, [...(validationMap.get(path) ?? []), error]);
							}
							setFormErrors(validationMap.get('form') ?? []);
							toast.error('Invalid Data', { duration: 3000, id: toastId });
							break;
						}
						default:
							console.error(error);
					}
				}
			},
			onPending() {
				return toast.loading('Logging in...', { duration: Number.POSITIVE_INFINITY });
			},
			onSuccess(_, toastId) {
				setFormErrors([]);
				toast.success('Login successful', { duration: 3000, id: toastId });
			}
		},
		{ always: true }
	);

	return (
		<form
			class="grid h-full place-content-center"
			onSubmit={async (event) => {
				event.preventDefault();
				const form = event.target as HTMLFormElement;
				const formData = new FormData(form);
				const result = await $signIn(formData);
				if (result instanceof Error) return;
				const { encryptedPrivateKey, publicKey, salt } = result;
				if (!(encryptedPrivateKey === null || salt === null || publicKey === null)) {
					const parsedSalt = new Uint8Array(atob(salt).split(',').map(Number));
					const derivationKey = await getPasswordKey(formData.get('password') as string);
					const privateKey = await deriveKey(derivationKey, parsedSalt, ['decrypt']);
					const decryptedPrivateKey = await decryptDataWithKey(encryptedPrivateKey, privateKey);
					await localforage.setMany({
						privateKey: decryptedPrivateKey,
						publicKey: atob(publicKey),
						salt: parsedSalt
					});
				}
				await revalidate(getUser.key);
			}}
		>
			<Card class="w-full max-w-sm">
				<CardHeader>
					<CardTitle class="text-2xl">Sign In</CardTitle>
					<CardDescription>Enter your details below to login to your account.</CardDescription>
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
							onInput={(e) => setEmail(e.currentTarget.value)}
							placeholder="m@example.com"
							required
							type="email"
							value={email()}
						/>
					</TextField>
					<TextField>
						<div class="flex items-center justify-between gap-2">
							<TextFieldLabel for="password">Password</TextFieldLabel>
							<Button
								onClick={() => {
									try {
										const $email = z.string().email().parse(email());
										navigate('/auth/forgot-password?email=' + $email);
									} catch {
										toast.error('Invalid email', { duration: 3000 });
									}
								}}
								variant="link"
							>
								Forgot Password?
							</Button>
						</div>
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
				</CardContent>
				<CardFooter class="grid gap-4 sm:grid-cols-2">
					<Button class="w-full" type="submit">
						Sign in
					</Button>
					<Button as={A} href="/auth/signup" variant="ghost">
						Sign Up Instead
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
