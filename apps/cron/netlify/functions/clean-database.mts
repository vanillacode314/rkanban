import type { Config } from "@netlify/functions";
import { db } from "../../src/db";
import { users } from "../../drizzle/schema";

export default async (req: Request) => {
  const { next_run } = await req.json();
  console.log(await db.select().from(users));
  console.log("Received event! Next invocation at:", next_run);
};

export const config: Config = {
  schedule: "@hourly",
};
