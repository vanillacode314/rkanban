import { For, Show } from 'solid-js';

import { useApp } from '~/context/app';
import * as path from '~/utils/path';

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator
} from './ui/breadcrumb';

export function PathCrumbs() {
	const [appContext, _] = useApp();
	const parts = () => {
		const compressedParts = path.splitIntoParts(path.compressPath(appContext.path));
		return path
			.splitIntoParts(appContext.path)
			.map((part, index) => ({ name: compressedParts[index].name, path: part.path }));
	};

	return (
		<div class="flex gap-1">
			<a class="mr-2 text-sm text-muted-foreground" href="/">
				/<span class="sr-only">Home</span>
			</a>
			<Breadcrumb>
				<BreadcrumbList>
					<For each={parts()}>
						{({ name, path }, index) => (
							<>
								<BreadcrumbItem>
									<BreadcrumbLink href={path}>{name}</BreadcrumbLink>
								</BreadcrumbItem>
								<Show when={index() < parts().length - 1}>
									<BreadcrumbSeparator />
								</Show>
							</>
						)}
					</For>
				</BreadcrumbList>
			</Breadcrumb>
		</div>
	);
}

export default PathCrumbs;
