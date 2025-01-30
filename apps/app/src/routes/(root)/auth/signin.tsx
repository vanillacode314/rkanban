import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import env from '~/utils/env/client';

export default function SignInPage() {
	const rsuiteUrl = new URL('https://account.raqueeb.com/auth');
	rsuiteUrl.searchParams.set('client_id', env.PUBLIC_RSUITE_CLIENT_ID);
	rsuiteUrl.searchParams.set('scope', 'read:profile');
	rsuiteUrl.searchParams.set('state', 'abc');
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
