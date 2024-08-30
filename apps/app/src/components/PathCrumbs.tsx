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
	const parts = () => {
		const compressedParts = path.splitIntoParts(path.compressPath(appContext.path));
		return path
			.splitIntoParts(appContext.path)
			.map((part, index) => ({ name: compressedParts[index].name, path: part.path }));
	};

	return (
		<div class="flex gap-1">
			<span class="mr-2 text-sm text-muted-foreground">/</span>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="/">home</BreadcrumbLink>
					</BreadcrumbItem>
					<For each={parts()}>
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
