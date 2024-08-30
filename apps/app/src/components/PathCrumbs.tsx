import { For } from 'solid-js';
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator
} from '~/components/ui/breadcrumb';
import { useApp } from '~/context/app';
import { cn } from '~/lib/utils';
import * as path from '~/utils/path';

export function PathCrumbs() {
	const [appContext, _setAppContext] = useApp();

	return (
		<div class="flex gap-1">
			<span class="mr-2 text-sm text-muted-foreground">/</span>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">home</BreadcrumbLink>
					</BreadcrumbItem>
					<For each={path.splitIntoParts(path.compressPath(appContext.path))}>
						{({ name, path }) => (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbLink href={path}>{name}</BreadcrumbLink>
								</BreadcrumbItem>
							</>
						)}
					</For>
				</BreadcrumbList>
			</Breadcrumb>
		</div>
	);
}

export default PathCrumbs;
