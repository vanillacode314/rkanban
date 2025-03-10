export default defineEventHandler(async (event) => {
	deleteCookie(event, 'rKanbanAuthSource');
	deleteCookie(event, 'rKanbanAccessToken');
	deleteCookie(event, 'rKanbanRefreshToken');
	return sendRedirect(event, '/');
});
