import { createAsync } from '@solidjs/router';
import { JSXElement } from 'solid-js';
import { getUser } from '~/utils/auth.server';

export const route = {
	preload: () => getUser()
};
export default function AuthLayout(props: { children: JSXElement }): JSXElement {
	createAsync(() => getUser());
	return <>{props.children}</>;
}
