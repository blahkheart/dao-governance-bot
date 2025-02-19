import { createConfig } from "ponder";
import { http } from "viem";
import DAO_GOVERNOR_ABI from "./abis/GovernorContractAbi";

const { START_BLOCK, DAO_GOVERNOR_ADDRESS } = process.env;

if (!START_BLOCK || !DAO_GOVERNOR_ADDRESS) {
  throw new Error("START_BLOCK and DAO_GOVERNOR_ADDRESS must be set");
}

export default createConfig({
  networks: {
    baseMainnet: {
      chainId: 8453,
      transport: http(process.env.PONDER_RPC_URL_BASE_MAINNET),
    },
  },
  contracts: {
    DAOGovernor: {
      network: "baseMainnet",
      abi: DAO_GOVERNOR_ABI,
      address: DAO_GOVERNOR_ADDRESS as `0x${string}`,
      startBlock: Number(START_BLOCK),
    },
  },
});
