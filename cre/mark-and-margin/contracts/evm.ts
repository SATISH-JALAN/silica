import { EVMClient, LAST_FINALIZED_BLOCK_NUMBER, bytesToHex, encodeCallMsg, getNetwork, type Runtime } from "@chainlink/cre-sdk"
import { decodeFunctionResult, encodeFunctionData, zeroAddress, type Abi, type Address } from "viem"

export function evmFor(chainName: string) {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: chainName })
  if (!network) throw new Error(`unknown chain ${chainName}`)
  return { client: new EVMClient(network.chainSelector.selector), selector: network.chainSelector.selector }
}

/** One finalized-block contract read, decoded with viem */
export function read<T>(runtime: Runtime<unknown>, evm: EVMClient, to: Address, abi: Abi, functionName: string, args: unknown[] = []): T {
  const data = encodeFunctionData({ abi, functionName, args } as never)
  const res = evm
    .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to, data }), blockNumber: LAST_FINALIZED_BLOCK_NUMBER })
    .result()
  return decodeFunctionResult({ abi, functionName, data: bytesToHex(res.data) } as never) as T
}

const MULTICALL3: Address = "0xcA11bde05977b3631167028862bE2a173976CA11"
const multicall3Abi = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [{ name: "calls", type: "tuple[]", components: [{ name: "target", type: "address" }, { name: "allowFailure", type: "bool" }, { name: "callData", type: "bytes" }] }],
    outputs: [{ name: "returnData", type: "tuple[]", components: [{ name: "success", type: "bool" }, { name: "returnData", type: "bytes" }] }],
  },
] as const satisfies Abi

export type Call = { to: Address; abi: Abi; functionName: string; args?: unknown[]; allowFailure?: boolean }

/**
 * Many reads as ONE CRE chain read via Multicall3. CRE caps a run at 15 chain reads and each
 * response at 5 KB (production limits), so callers keep each batch small. A call marked
 * allowFailure decodes to null when it reverts (e.g. a book that does not exist yet).
 */
export function readMany(runtime: Runtime<unknown>, evm: EVMClient, calls: Call[]): unknown[] {
  if (calls.length === 0) return []
  const encoded = calls.map((c) => ({ target: c.to, allowFailure: c.allowFailure ?? false, callData: encodeFunctionData({ abi: c.abi, functionName: c.functionName, args: c.args ?? [] } as never) }))
  const res = read<readonly { success: boolean; returnData: `0x${string}` }[]>(runtime, evm, MULTICALL3, multicall3Abi, "aggregate3", [encoded])
  return res.map((r, i) =>
    r.success && r.returnData !== "0x" ? decodeFunctionResult({ abi: calls[i].abi, functionName: calls[i].functionName, data: r.returnData } as never) : null,
  )
}
