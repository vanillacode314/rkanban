import{z as e}from"zod";var i=e.discriminatedUnion("type",[e.object({type:e.literal("publish"),item:e.discriminatedUnion("type",[e.object({type:e.literal("create"),table:e.string(),id:e.string(),data:e.record(e.string(),e.unknown())}),e.object({type:e.literal("update"),table:e.string(),id:e.string(),data:e.record(e.string(),e.unknown())}),e.object({type:e.literal("delete"),table:e.string(),id:e.string()})])}),e.object({type:e.literal("subscribe")})]);export{i as messageSchema};
//# sourceMappingURL=index.mjs.map