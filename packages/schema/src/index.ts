import { z } from 'zod';

const messageSchema = z.discriminatedUnion('type', [
	z.object({
		id: z.string().optional(),
		item: z.object({
			data: z.record(z.string(), z.unknown()).optional(),
			id: z.string(),
			table: z.string(),
			type: z.enum(['create', 'update', 'delete'])
		}),
		type: z.literal('publish')
	}),
	z.object({
		id: z.string().optional(),
		type: z.literal('subscribe')
	})
]);
type TMessage = z.infer<typeof messageSchema>;

export { messageSchema };
export type { TMessage };
