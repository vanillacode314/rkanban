import { Key } from '@solid-primitives/keyed';
import { createAsync, useLocation, useSubmissions } from '@solidjs/router';
import { Show } from 'solid-js';
import Board from '~/components/Board';
import PathCrumbs from '~/components/PathCrumbs';
import { setCreateBoardModalOpen } from '~/components/modals/auto-import/CreateBoardModal';
import { Button } from '~/components/ui/button';
import { RESERVED_PATHS } from '~/consts/index';
import { useApp } from '~/context/app';
import { createBoard, getBoards } from '~/db/utils/boards';

export const route = {
	preload: () => {
		const location = useLocation();
		getBoards(location.pathname);
	},
	matchFilters: {
		project: (value: string) => value.endsWith('.project') && !RESERVED_PATHS.includes(value)
	}
};

export default function Home() {
	const [appContext, _setAppContext] = useApp();
	const serverBoards = createAsync(() => getBoards(appContext.path));
	const submissions = useSubmissions(createBoard);

	const pendingBoards = () =>
		[...submissions.values()]
			.filter((submission) => submission.pending)
			.map((submission) => ({
				id: String(submission.input[0].get('id')),
				title: String(submission.input[0].get('title')) + ' (pending)',
				tasks: [],
				createdAt: new Date(),
				updatedAt: new Date(),
				userId: 'pending',
				index: serverBoards()!.length
			}));

	const boards = () => (serverBoards() ? [...serverBoards()!, ...pendingBoards()] : []);

	return (
		<div class="flex h-full flex-col gap-4 overflow-hidden py-4">
			<Show when={boards().length > 0}>
				<div class="flex justify-end gap-4">
					<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
						<span class="i-heroicons:plus text-lg"></span>
						<span>Create Board</span>
					</Button>
				</div>
			</Show>
			<PathCrumbs />
			<Show
				when={boards().length > 0}
				fallback={
					<div class="grid h-full place-content-center place-items-center gap-4 font-medium">
						<span>Empty Project</span>
						<div class="flex flex-col items-center justify-end gap-4 sm:flex-row">
							<Button class="flex items-center gap-2" onClick={() => setCreateBoardModalOpen(true)}>
								<span class="i-heroicons:plus text-lg"></span>
								<span>Create Board</span>
							</Button>
						</div>
					</div>
				}
			>
				<div class="flex h-full snap-x snap-mandatory gap-[var(--gap)] overflow-auto [--cols:1] [--gap:theme(spacing.4)] sm:[--cols:2] md:[--cols:3]">
					<Key each={boards()} by="id">
						{(board, index) => (
							<Board
								class="shrink-0 basis-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))] snap-start"
								board={board()}
								index={index()}
							/>
						)}
					</Key>
				</div>
			</Show>
		</div>
	);
}
