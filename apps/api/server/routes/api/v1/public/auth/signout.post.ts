export default defineEventHandler(async (event) => {
	deleteCookie(event, 'authSource');
	deleteCookie(event, 'accessToken');
	deleteCookie(event, 'refreshToken');
	return sendRedirect(event, '/');
});
