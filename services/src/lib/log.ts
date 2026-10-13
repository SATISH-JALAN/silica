/** Structured JSON logs so every slash or confirmation can be traced in the demo. */
export const logger = (service: string) => {
  const out = (level: string) => (msg: string, data: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ t: new Date().toISOString(), service, level, msg, ...data }, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
  return { info: out("info"), warn: out("warn"), error: out("error") };
};
