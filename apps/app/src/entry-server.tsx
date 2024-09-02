// @refresh reload
import { ColorModeScript, cookieStorageManagerSSR } from '@kobalte/core';
import { createHandler, StartServer } from '@solidjs/start/server';

export default createHandler(() => (
	<StartServer
		document={({ assets, children, scripts }) => {
			return (
				<html lang="en">
					<head>
						<meta charset="utf-8" />
						<meta
							name="viewport"
							content="width=device-width, initial-scale=1, interactive-widget=resizes-content"
						/>
						<meta name="description" content="The best way to manage your projects" />
						<link rel="manifest" href="/manifest.webmanifest" />
						<link rel="icon" href="/favicon.ico" sizes="48x48" />
						<link rel="icon" href="/favicon-flattened.svg" sizes="any" type="image/svg+xml" />
						<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
						<meta name="theme-color" content="#000000" />
						{assets}
					</head>
					<body>
						<ColorModeScript storageType="cookie" />
						<div id="app">{children}</div>
						{scripts}
					</body>
				</html>
			);
		}}
	/>
));
