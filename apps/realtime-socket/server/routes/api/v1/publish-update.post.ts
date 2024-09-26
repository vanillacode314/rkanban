import { publishSchema } from 'schema';

const dbUpdatesChannel = new BroadcastChannel('db-updates');
export default defineEventHandler(async (event) => {
	const result = await readValidatedBody(event, publishSchema.safeParse);

	if (!result.success) {
		return { error: result.error.errors, success: false };
	}

	dbUpdatesChannel.postMessage(result.data);
	return { message: 'Successfully published', success: true };
});
