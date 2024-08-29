import {
	ColorModeProvider,
	ColorModeScript,
	cookieStorageManagerSSR,
	useColorMode
} from '@kobalte/core/color-mode';
import { createConnectivitySignal } from '@solid-primitives/connectivity';
import { Title } from '@solidjs/meta';
import { RouteSectionProps, useBeforeLeave, useLocation, useNavigate } from '@solidjs/router';
import { For, JSXElement, createEffect } from 'solid-js';
import { isServer } from 'solid-js/web';
import { toast } from 'solid-sonner';
import { getCookie } from 'vinxi/http';
import Nav from '~/components/Nav';
import { Toaster } from '~/components/ui/sonner';
import { AppProvider } from '~/context/app';

function AutoImportModals() {
	const modals = import.meta.glob('~/components/modals/auto-import/*.tsx', {
		eager: true,
		import: 'default'
	}) as Record<string, () => JSXElement>;

	return <For each={Object.values(modals)}>{(Modal) => <Modal />}</For>;
}
function getServerCookies() {
	'use server';
	const colorMode = getCookie('kb-color-mode');
	return colorMode ? `kb-color-mode=${colorMode}` : '';
}
const RootLayout = (props: RouteSectionProps) => {
	const location = useLocation();
	const path = () => decodeURIComponent(location.pathname);
	const storageManager = cookieStorageManagerSSR(isServer ? getServerCookies() : document.cookie);
	useBeforeLeave(() => toast.dismiss());
	const navigate = useNavigate();
	const isOnline = createConnectivitySignal();
	createEffect(() => !isOnline() && navigate('/offline'));

	return (
		<>
			<ColorModeScript storageType={storageManager.type} />
			<ColorModeProvider storageManager={storageManager}>
				<AppProvider path={path()}>
					<Title>JustKanban</Title>
					<ColoredToaster />
					<div class="flex h-full flex-col overflow-hidden">
						<Nav class="full-width content-grid" />
						<div class="content-grid h-full overflow-hidden">{props.children}</div>
					</div>
					<AutoImportModals />
				</AppProvider>
			</ColorModeProvider>
		</>
	);
};

function ColoredToaster() {
	const { colorMode } = useColorMode();
	return <Toaster />;
}
export default RootLayout;
