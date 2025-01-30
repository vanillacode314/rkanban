export default defineEventHandler(async (event) => {
	if (event.context.auth === null)
		return new Response('null', { headers: { 'Content-Type': 'application/json' } });
	return event.context.auth;
});
