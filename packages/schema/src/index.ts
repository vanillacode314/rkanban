import { z } from 'zod';

const messageSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('publish'),
		item: z.discriminatedUnion('type', [
			z.object({
				type: z.literal('create'),
				table: z.string(),
				id: z.string(),
				data: z.record(z.string(), z.unknown())
			}),
			z.object({
				type: z.literal('update'),
				table: z.string(),
				id: z.string(),
				data: z.record(z.string(), z.unknown())
			}),
			z.object({
				type: z.literal('delete'),
				table: z.string(),
				id: z.string()
			})
		])
	}),
	z.object({ type: z.literal('subscribe') })
]);
type TMessage = z.infer<typeof messageSchema>;

export { messageSchema };
export type { TMessage };
