import { z } from 'zod';
declare const messageSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"publish">;
    item: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"create">;
        table: z.ZodString;
        id: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "create";
        table: string;
        id: string;
        data: Record<string, unknown>;
    }, {
        type: "create";
        table: string;
        id: string;
        data: Record<string, unknown>;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"update">;
        table: z.ZodString;
        id: z.ZodString;
        data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "update";
        table: string;
        id: string;
        data: Record<string, unknown>;
    }, {
        type: "update";
        table: string;
        id: string;
        data: Record<string, unknown>;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"delete">;
        table: z.ZodString;
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "delete";
        table: string;
        id: string;
    }, {
        type: "delete";
        table: string;
        id: string;
    }>]>;
}, "strip", z.ZodTypeAny, {
    type: "publish";
    item: {
        type: "create";
        table: string;
        id: string;
        data: Record<string, unknown>;
    } | {
        type: "update";
        table: string;
        id: string;
        data: Record<string, unknown>;
    } | {
        type: "delete";
        table: string;
        id: string;
    };
}, {
    type: "publish";
    item: {
        type: "create";
        table: string;
        id: string;
        data: Record<string, unknown>;
    } | {
        type: "update";
        table: string;
        id: string;
        data: Record<string, unknown>;
    } | {
        type: "delete";
        table: string;
        id: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"subscribe">;
}, "strip", z.ZodTypeAny, {
    type: "subscribe";
}, {
    type: "subscribe";
}>]>;
type TMessage = z.infer<typeof messageSchema>;
export { messageSchema };
export type { TMessage };
//# sourceMappingURL=index.d.ts.map