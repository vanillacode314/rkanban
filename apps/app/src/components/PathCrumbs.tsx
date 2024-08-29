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
		<Breadcrumb class={cn(appContext.path === '/' && 'invisible')}>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink href="/">home</BreadcrumbLink>
				</BreadcrumbItem>
				<For each={path.splitIntoParts(appContext.path)}>
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
	);
}

export default PathCrumbs;
