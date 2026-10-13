import { z } from "zod";

export const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const privateKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

/** Signed hourly summary served by provider-agent and buyer-probe at /summary/:ticketId/:hour */
export const signedSummarySchema = z.object({
  ticketId: z.string(),
  hour: z.number().int().min(0),
  okChecks: z.number().int().min(0).max(12),
  gpuIdHash: hex,
  signer: address,
  signature: hex,
});

export const baseServiceEnv = z.object({
  RPC_URL: z.string().url().default("https://testnet-rpc.monad.xyz"),
  RPC_WS_URL: z.string().default("wss://testnet-rpc.monad.xyz"),
  PORT: z.coerce.number().int().default(8080),
  DEMO_MODE: z
    .string()
    .default("1")
    .transform((v) => v === "1" || v === "true"),
});

