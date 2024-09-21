// @refresh reload
import { ColorModeScript } from '@kobalte/core';
import { createHandler, StartServer } from '@solidjs/start/server';

export default createHandler(() => (
	<StartServer
		document={({ assets, children, scripts }) => {
			return (
				<html lang="en">
					<head>
						<meta charset="utf-8" />
						<meta
							content="width=device-width, initial-scale=1, interactive-widget=resizes-content"
							name="viewport"
						/>
						<meta content="The best way to manage your projects" name="description" />
						<link href="/manifest.webmanifest" rel="manifest" />
						<link href="/favicon.ico" rel="icon" sizes="48x48" />
						<link href="/favicon-flattened.svg" rel="icon" sizes="any" type="image/svg+xml" />
						<link href="/apple-touch-icon-180x180.png" rel="apple-touch-icon" />
						<meta content="#000000" name="theme-color" />
						{assets}
						{import.meta.env.PROD && (
							<script
								data-domain="kanban.raqueeb.com"
								defer
								src="https://plausible.raqueeb.com/js/script.js"
							/>
						)}
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
