import {
	A,
	action,
	redirect,
	useAction,
	useNavigate,
	useSearchParams,
	useSubmission
} from '@solidjs/router';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { Show, createEffect, createSignal, untrack } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { z } from 'zod';
import ValidationErrors from '~/components/form/ValidationErrors';
import { useSeedPhraseVerifyModal } from '~/components/modals/auto-import/SeedPhraseVerifyModal';
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
import { passwordSchema } from '~/consts/zod';
import { db } from '~/db';
import { forgotPasswordTokens, users } from '~/db/schema';
import {
	deriveKey,
	encryptDataWithKey,
	encryptKey,
	getPasswordKey,
	importKey
} from '~/utils/crypto';

const resetPasswordSchema = z
	.object({
		email: z.string({ required_error: 'Email is required' }).email(),
		password: passwordSchema,
		confirmPassword: z.string(),
		token: z.string({ required_error: 'Token is required' }),
		encryptedPrivateKey: z.string().optional()
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
	const { token, email, password, encryptedPrivateKey } = result.data;

	const [$token] = await db
		.select()
		.from(forgotPasswordTokens)
		.where(eq(forgotPasswordTokens.token, token));

	if (!$token) return new Error('Invalid token', { cause: 'INVALID_TOKEN' });
	if ($token.expiresAt.getTime() < Date.now())
		return new Error('Token expired', { cause: 'EXPIRED_TOKEN' });

	const [user] = await db.select().from(users).where(eq(users.id, $token.userId)).limit(1);

	if (user.email !== email) return new Error('Invalid email', { cause: 'INVALID_EMAIL' });

	console.log(formData);
	if (user.salt !== null) {
		if (!encryptedPrivateKey)
			return new Error('Please enter your seed phrase to reset your password.', {
				cause: 'ENCRYPTION_ENABLED'
			});
	}

	const passwordHash = await bcrypt.hash(password, 10);

	await db.transaction(async (tx) => {
		await tx
			.update(users)
			.set({ passwordHash, encryptedPrivateKey })
			.where(eq(users.email, email))
			.returning();
		await tx.delete(forgotPasswordTokens).where(eq(forgotPasswordTokens.userId, user.id));
	});

	return redirect('/auth/signin');
}, 'reset-password');

const getEncryptionChallenge = async (token: string, email: string) => {
	'use server';

	const [$token] = await db
		.select()
		.from(forgotPasswordTokens)
		.where(eq(forgotPasswordTokens.token, token));

	if (!$token) return new Error('Invalid token', { cause: 'INVALID_TOKEN' });

	const [user] = await db.select().from(users).where(eq(users.id, $token.userId)).limit(1);

	if (user.email !== email) return new Error('Invalid email', { cause: 'INVALID_EMAIL' });

	if (user.publicKey !== null && user.salt !== null) {
		const decryptedString = 'super-duper-secret';
		const $publicKey = await importKey(atob(user.publicKey), ['encrypt']);
		const encryptedString = await encryptDataWithKey(decryptedString, $publicKey);
		const $salt = new Uint8Array(atob(user.salt).split(',').map(Number));
		return {
			decryptedString,
			encryptedString,
			salt: $salt
		};
	}

	return null;
};

export default function ResetPasswordPage() {
	const navigate = useNavigate();
	const [searchParams, _setSearchParams] = useSearchParams();
	const token = () => searchParams.token;

	const submission = useSubmission(resetPassword);
	const [passwordVisible, setPasswordVisible] = createSignal<boolean>(false);
	const [emailErrors, setEmailErrors] = createStore<string[]>([]);
	const [passwordErrors, setPasswordErrors] = createStore<string[]>([]);
	const [formErrors, setFormErrors] = createStore<string[]>([]);
	const seedPhraseVerifyModal = useSeedPhraseVerifyModal();
	const [encryptedPrivateKey, setEncryptedPrivateKey] = createSignal<string>('');
	const $resetPassword = useAction(resetPassword);

	let toastId: string | number | undefined;
	createEffect(() => {
		const { result, pending } = submission;

		untrack(() => {
			if (pending) {
				if (toastId) toast.dismiss(toastId);
				toastId = toast.loading('Reseting Password...', { duration: Number.POSITIVE_INFINITY });
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
						setEmailErrors(validationMap.get('email') ?? []);
						setPasswordErrors(validationMap.get('password') ?? []);
						setFormErrors(validationMap.get('form') ?? []);
						toast.error('Invalid Data', { id: toastId, duration: 3000 });
						break;
					}
					case 'INVALID_TOKEN': {
						toast.error('Invalid Token', {
							action: {
								label: 'Go to sign in page',
								onClick() {
									navigate('/auth/signin');
								}
							}
						});
						break;
					}
					case 'INVALID_EMAIL': {
						toast.error('Invalid Email', { id: toastId, duration: 3000 });
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
			<form
				class="grid h-full place-content-center"
				onSubmit={async (event) => {
					event.preventDefault();
					const form = event.target as HTMLFormElement;
					const formData = new FormData(form);
					const email = String(formData.get('email'));
					const token = String(formData.get('token'));
					const password = String(formData.get('password'));
					const challenge = await getEncryptionChallenge(token, email);
					if (challenge instanceof Error) {
						setFormErrors([challenge.message]);
						return;
					}
					if (challenge !== null) {
						const { encryptedString, salt, decryptedString } = challenge;
						await new Promise<void>((resolve) => {
							seedPhraseVerifyModal.open({
								encryptedString,
								decryptedString,
								salt,
								onDismiss() {
									setEncryptedPrivateKey('');
									resolve();
								},
								async onVerified(seedPhrase) {
									const derivationKey = await getPasswordKey(seedPhrase);
									const privateKey = await deriveKey(derivationKey, salt, ['decrypt']);
									const derivationKey2 = await getPasswordKey(password);
									const publicKey2 = await deriveKey(derivationKey2, salt, ['encrypt']);
									const encryptedPrivateKey = await encryptKey(privateKey, publicKey2);
									setEncryptedPrivateKey(encryptedPrivateKey);
									resolve();
								}
							});
						});
					}
					{
						const formData = new FormData(form);
						await $resetPassword(formData);
					}
				}}
			>
				<Card class="w-full max-w-sm">
					<CardHeader>
						<CardTitle class="text-2xl">Reset Password</CardTitle>
						<CardDescription>Create a new password</CardDescription>
					</CardHeader>
					<CardContent class="grid gap-4">
						<input type="hidden" name="token" value={token()} />
						<input type="hidden" name="encryptedPrivateKey" value={encryptedPrivateKey()} />
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
											fallback={<span class="i-heroicons:eye-slash text-lg" />}
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
