import iconsJson from '~/data/icons.json';

export function GET() {
	return {
		background_color: '#000000',
		categories: ['productivity', 'utility', 'tasks'],
		description: 'Manage projects using kanban boards',
		dir: 'ltr',
		display: 'standalone',
		edge_side_panel: {
			preferred_width: 400
		},
		handle_links: 'preferred',
		icons: iconsJson,
		id: 'com.raqueeb.kanban',
		lang: 'en-US',
		name: 'RKanban',
		orientation: 'natural',
		prefer_related_applications: false,
		scope: '/',
		short_name: 'rkanban',
		start_url: '/',
		theme_color: '#000000'
	};
}
