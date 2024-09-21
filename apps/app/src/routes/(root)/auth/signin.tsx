import { A, action, useAction, useNavigate, useSubmission } from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { Show, createEffect, createSignal, untrack } from 'solid-js';
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
		userId: user.id,
		token: refreshToken,
		expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000)
	});

	setCookie('accessToken', accessToken, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});
	setCookie('refreshToken', refreshToken, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		path: '/',
		sameSite: 'lax',
		maxAge: 2 ** 31
	});
	return { ...user, passwordHash: undefined };
}, 'signin');

export default function SignInPage() {
	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const submission = useSubmission(signIn);
	const $signIn = useAction(signIn);
	const [email, setEmail] = createSignal('');
	const navigate = useNavigate();
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
					case 'VALIDATION_ERROR': {
						const validationMap = new Map<string, string[]>();
						for (const message of result.message.split(';;;')) {
							const [path, error] = message.split(';;');
							validationMap.set(path, [...(validationMap.get(path) ?? []), error]);
						}
						setFormErrors(validationMap.get('form') ?? []);
						toast.error('Invalid Data', { id: toastId, duration: 3000 });
						break;
					}
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
		<form
			class="grid h-full place-content-center"
			onSubmit={async (event) => {
				event.preventDefault();
				const form = event.target as HTMLFormElement;
				const formData = new FormData(form);
				const result = await $signIn(formData);
				if (result instanceof Error) return;
				const { encryptedPrivateKey, salt, publicKey } = result;
				if (encryptedPrivateKey === null || salt === null || publicKey === null) {
					navigate('/');
					return;
				}
				const parsedSalt = new Uint8Array(atob(salt).split(',').map(Number));
				const derivationKey = await getPasswordKey(formData.get('password') as string);
				const privateKey = await deriveKey(derivationKey, parsedSalt, ['decrypt']);
				const decryptedPrivateKey = await decryptDataWithKey(encryptedPrivateKey, privateKey);
				await localforage.setMany({
					privateKey: decryptedPrivateKey,
					salt: parsedSalt,
					publicKey: atob(publicKey)
				});
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
							autofocus
							value={email()}
							onInput={(e) => setEmail(e.currentTarget.value)}
							id="email"
							type="email"
							name="email"
							placeholder="m@example.com"
							required
							autocomplete="username"
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
										toast.error('Invalid email', { id: toastId, duration: 3000 });
									}
								}}
								variant="link"
							>
								Forgot Password?
							</Button>
						</div>
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
										fallback={<span class="i-heroicons:eye-slash text-lg" />}
									>
										<span class="i-heroicons:eye-solid text-lg" />
									</Show>
								)}
							</Toggle>
						</div>
					</TextField>
				</CardContent>
				<CardFooter class="grid gap-4 sm:grid-cols-2">
					<Button type="submit" class="w-full">
						Sign in
					</Button>
					<Button variant="ghost" href="/auth/signup" as={A}>
						Sign Up Instead
					</Button>
				</CardFooter>
			</Card>
		</form>
	);
}
