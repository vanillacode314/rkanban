import iconsJson from '~/data/icons.json';

export function GET() {
	return {
		id: 'com.raqueeb.kanban',
		short_name: 'rkanban',
		name: 'RKanban',
		start_url: '/',
		background_color: '#000000',
		display: 'standalone',
		scope: '/',
		theme_color: '#000000',
		handle_links: 'preferred',
		orientation: 'natural',
		edge_side_panel: {
			preferred_width: 400
		},
		categories: ['productivity', 'utility', 'tasks'],
		dir: 'ltr',
		prefer_related_applications: false,
		lang: 'en-US',
		icons: iconsJson,
		description: 'Manage projects using kanban boards'
	};
}
