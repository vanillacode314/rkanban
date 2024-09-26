import type { Config } from "@netlify/functions";
import { db } from "~/db";
import {
  forgotPasswordTokens,
  refreshTokens,
  users,
  verificationTokens,
} from "db/schema";
import { lt, and, eq, inArray, count } from "drizzle-orm";
import { ms } from "~/utils/ms";

const UNVERIFIED_ALLOWED_DURATION = ms("30 days");

async function deleteUnverifiedUsers() {
  const $users = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.emailVerified, false),
        lt(users.createdAt, new Date(Date.now() - UNVERIFIED_ALLOWED_DURATION)),
      ),
    );

  console.log(
    `Found ${$users.length} non-verified users to delete.`,
    $users.map((user) => user.email).join(", "),
  );
  if ($users.length > 0) {
    await db.delete(users).where(
      inArray(
        users.id,
        $users.map((user) => user.id),
      ),
    );
  }
}

async function deleteExpiredVerificationTokens() {
  const result = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expiresAt, new Date()));

  console.log(`Deleted ${result.rowsAffected} verification tokens.`);
}

async function deleteExpiredRefreshTokens() {
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, new Date()));

  console.log(`Deleted ${result.rowsAffected} refresh tokens.`);
}

async function deleteExpiredForgotPasswordTokens() {
  const result = await db
    .delete(forgotPasswordTokens)
    .where(lt(forgotPasswordTokens.expiresAt, new Date()));

  console.log(`Deleted ${result.rowsAffected} forgot password tokens.`);
}
export default async (req: Request) => {
  const { next_run } = await req.json();

  const tasks = [
    deleteUnverifiedUsers(),
    deleteExpiredVerificationTokens(),
    deleteExpiredRefreshTokens(),
    deleteExpiredForgotPasswordTokens(),
  ];

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  }

  console.log("Received event! Next invocation at:", next_run);
};

export const config: Config = {
  schedule: "@hourly",
};
