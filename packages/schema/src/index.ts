import { z } from 'zod';

const messageSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('publish'),
		item: z.object({
			type: z.enum(['create', 'update', 'delete']),
			table: z.string(),
			id: z.string(),
			data: z.record(z.string(), z.unknown()).optional()
		})
	}),
	z.object({ type: z.literal('subscribe') })
]);
type TMessage = z.infer<typeof messageSchema>;

export { messageSchema };
export type { TMessage };
