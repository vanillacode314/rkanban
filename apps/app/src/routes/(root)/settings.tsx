import { makePersisted } from '@solid-primitives/storage';
import { action, createAsync, redirect, useAction } from '@solidjs/router';
import { eq } from 'drizzle-orm';
import { Show, createEffect, createSignal } from 'solid-js';
import { toast } from 'solid-sonner';
import { deleteCookie } from 'vinxi/http';
import { useConfirmModal } from '~/components/modals/auto-import/ConfirmModal';
import { useSeedPhraseModal } from '~/components/modals/auto-import/SeedPhraseModal';
import { Button } from '~/components/ui/button';
import { db } from '~/db';
import { users } from '~/db/schema';
import { cn } from '~/lib/utils';
import { getUser } from '~/utils/auth.server';
import { generateSeedPhrase } from '~/utils/crypto';

const deleteUser = action(async () => {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');
	await db.delete(users).where(eq(users.id, user.id));
	deleteCookie('accessToken');
	deleteCookie('refreshToken');
	throw redirect('/auth/signup');
}, 'delete-user');

const disableEncryption = action(async () => {
	'use server';

	const user = await getUser();
	if (!user) throw redirect('/auth/signin');
	await db
		.update(users)
		.set({ encryptedPrivateKey: null, publicKey: null, salt: null })
		.where(eq(users.id, user.id));
	deleteCookie('accessToken');
}, 'disable-encryption');

export const route = {
	preload: () => getUser()
};

export default function SettingsPage() {
	const user = createAsync(() => getUser(), { deferStream: true });
	const encryptionEnabled = () =>
		user()?.encryptedPrivateKey !== null && user()?.publicKey !== null && user()?.salt !== null;
	const [seedPhraseVerified, setSeedPhraseVerified] = makePersisted(createSignal<boolean>(false), {
		name: 'seed-phrase-verified'
	});
	const confirmModal = useConfirmModal();
	const seedPhraseModal = useSeedPhraseModal();
	const $disableEncryption = useAction(disableEncryption);
	const $deleteUser = useAction(deleteUser);

	async function enableEncryption() {
		const seedPhrase = await generateSeedPhrase();
		seedPhraseModal.open({ seedPhrase });
	}

	return (
		<Show when={user()}>
			<div class="flex flex-col items-start gap-4 py-4">
				<header class="flex w-full flex-col gap-1 border-b pb-4">
					<h3 class="text-2xl font-bold">Settings</h3>
					<p class="text-muted-foreground">Manage your settings</p>
				</header>
				<div class="flex gap-4">
					<form
						action={deleteUser}
						method="post"
						onSubmit={(e) => {
							e.preventDefault();
							confirmModal.open({
								message: 'Are you sure you want to delete your account?',
								title: 'Delete User',
								onYes: () => {
									toast.promise(() => $deleteUser().then(() => window.location.reload()), {
										loading: 'Deleting User',
										success: 'Deleted User',
										error: 'Error'
									});
								}
							});
						}}
					>
						<Button variant="destructive" type="submit">
							Delete User
						</Button>
					</form>
					<Button
						onClick={async () => {
							if (encryptionEnabled()) {
								confirmModal.open({
									message: 'Are you sure you want to disable encryption?',
									title: 'Disable Encryption',
									onYes: () => {
										toast.promise(() => $disableEncryption().then(() => window.location.reload()), {
											loading: 'Disabling Encryption',
											success: 'Disabled Encryption',
											error: 'Error'
										});
									}
								});
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
			</div>
		</Show>
	);
}
