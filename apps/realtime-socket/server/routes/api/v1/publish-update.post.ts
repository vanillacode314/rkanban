import { messageSchema } from 'schema';

const dbUpdatesChannel = new BroadcastChannel('db-updates');
export default defineEventHandler(async (event) => {
	const result = await readValidatedBody(event, messageSchema.options[0].safeParse);

	if (!result.success) {
		return { success: false, error: result.error.errors };
	}

	dbUpdatesChannel.postMessage(result.data.item);
	return { success: true, message: 'Successfully published' };
});
