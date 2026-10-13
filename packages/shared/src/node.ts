import type { z } from "zod";

/** Validate service config at startup; refuse to start with a missing variable. */
export function parseEnv<T extends z.ZodTypeAny>(schema: T, env = process.env): z.infer<T> {
  const r = schema.safeParse(env);
  if (!r.success) {
    console.error(JSON.stringify({ level: "fatal", msg: "invalid config", issues: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }));
    process.exit(1);
  }
  return r.data;
}
