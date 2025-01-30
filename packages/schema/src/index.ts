import { usersSchema } from 'db/schema';
import { z } from 'zod';

const publishSchema = z.object({
	appId: z.string(),
	item: z.object({
		invalidate: z
			.string()
			.or(z.string().array())
			.transform((value) => (Array.isArray(value) ? value : [value])),
		message: z.string()
	}),
	token: z.string(),
	type: z.literal('publish')
});
type TPublishInput = z.input<typeof publishSchema>;
type TPublish = z.infer<typeof publishSchema>;

const subscribeSchema = z.object({
	appId: z.string(),
	token: z.string(),
	type: z.literal('subscribe')
});
type TSubscribe = z.infer<typeof subscribeSchema>;

const messageSchema = z.discriminatedUnion('type', [publishSchema, subscribeSchema]);
type TMessage = z.infer<typeof messageSchema>;

const authSchema = z.object({
	type: z.enum(['access']),
	user: usersSchema.omit({ createdAt: true, passwordHash: true, updatedAt: true })
});
type TAuth = z.infer<typeof authSchema>;

export { authSchema, messageSchema, publishSchema, subscribeSchema };
export type { TAuth, TMessage, TPublish, TPublishInput, TSubscribe };
