import { useNavigate } from '@solidjs/router';
import { createEffect } from 'solid-js';

import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { useUser } from '~/queries/user';
import env from '~/utils/env';

export default function SignInPage() {
	const rsuiteUrl = new URL('https://accounts.raqueeb.com/auth');
	rsuiteUrl.searchParams.set('client_id', env.PUBLIC_RSUITE_CLIENT_ID);
	rsuiteUrl.searchParams.set('scope', 'read:profile');
	rsuiteUrl.searchParams.set('state', 'abc');
	const navigate = useNavigate();

	const redirectTo = () =>
		location.search ? (new URLSearchParams(location.search).get('redirect') ?? '/') : '/';

	const [user] = useUser();

	createEffect(() => {
		if (user.isSuccess && user.data !== null) {
			navigate(redirectTo());
		}
	});

	return (
		<div class="grid h-full place-content-center">
			<Card class="w-full max-w-sm">
				<CardHeader>
					<CardTitle class="text-2xl">Sign In</CardTitle>
					<CardDescription>Sign in with one of the following accounts</CardDescription>
				</CardHeader>
				<CardContent class="grid gap-4">
					<Button as="a" href={rsuiteUrl.toString()}>
						Sign In with RSuite
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
