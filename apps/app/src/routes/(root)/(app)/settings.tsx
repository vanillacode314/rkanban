import { makePersisted } from '@solid-primitives/storage';
import { action, createAsync, redirect, useAction } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import { Show, createSignal } from 'solid-js';
import { deleteCookie } from 'vinxi/http';
import { useSeedPhraseModal } from '~/components/modals/auto-import/SeedPhraseModal';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { users } from '~/db/schema';
import { cn } from '~/lib/utils';
import { getUser } from '~/utils/auth.server';
import { deriveKey, encryptKey, generateSeedPhrase, getPasswordKey } from '~/utils/crypto';

const deleteUser = action(async () => {
	'use server';

	const user = await getUser();
	if (!user) return redirect('/auth/signin');
	await db.delete(users).where(eq(users.id, user.id));
	deleteCookie('accessToken');
	deleteCookie('refreshToken');
	return redirect('/auth/signup');
}, 'delete-user');

const disableEncryption = action(async () => {
	'use server';

	const user = await getUser();
	if (!user) return redirect('/auth/signin');
	await db
		.update(users)
		.set({ encryptedPrivateKey: null, publicKey: null, salt: null })
		.where(eq(users.id, user.id));
	deleteCookie('accessToken');
}, 'disable-encryption');

export default function SettingsPage() {
	const user = createAsync(() => getUser(), { deferStream: true });
	const encryptionEnabled = () =>
		user()?.encryptedPrivateKey !== null && user()?.publicKey !== null && user()?.salt !== null;
	const [seedPhraseVerified, setSeedPhraseVerified] = makePersisted(createSignal<boolean>(false), {
		name: 'seed-phrase-verified'
	});
	const seedPhraseModal = useSeedPhraseModal();
	const $disableEncryption = useAction(disableEncryption);

	async function enableEncryption() {
		const seedPhrase = await generateSeedPhrase();
		seedPhraseModal.open({ seedPhrase });
	}

	return (
		<Show when={user()}>
			<div class="flex flex-col items-start gap-4 py-4">
				<form action={deleteUser} method="post">
					<Button variant="destructive" type="submit">
						Delete User
					</Button>
				</form>
				<Button
					onClick={async () => {
						if (encryptionEnabled()) {
							await $disableEncryption();
							window.location.reload();
						} else {
							enableEncryption();
						}
					}}
					class="flex items-center gap-2"
				>
					<span
						class={cn(
							'text-xl',
							encryptionEnabled() ? 'i-heroicons:lock-closed' : 'i-heroicons:lock-open'
						)}
					/>
					<span>{encryptionEnabled() ? 'Disable Encryption' : 'Enable Encryption'}</span>
				</Button>
			</div>
		</Show>
	);
}
