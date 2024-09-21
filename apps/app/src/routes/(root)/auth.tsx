import { RouteDefinition, createAsync } from '@solidjs/router';
import { JSXElement } from 'solid-js';
import { getUser } from '~/utils/auth.server';

export const route: RouteDefinition = {
	preload: () => getUser({ redirectOnAuthenticated: true })
};
export default function AuthLayout(props: { children: JSXElement }): JSXElement {
	createAsync(() => getUser({ redirectOnAuthenticated: true }), { deferStream: true });
	return <>{props.children}</>;
}
