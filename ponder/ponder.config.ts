import { createConfig } from "ponder";
import { Abi, http } from "viem";
// import { DAO_GOVERNOR_ABI } from "../src/abi/index";
// import{ DAO_GOVERNOR_ABI }from "../src/abi/daoGovernor";
import DAO_GOVERNOR_ABI from "./abis/GovernorContractAbi";

const { TARGET_CHAIN_ID, START_BLOCK, DAO_GOVERNOR_ADDRESS } = process.env;

if (!TARGET_CHAIN_ID || !START_BLOCK) {
  throw new Error("TARGET_CHAIN_ID and START_BLOCK must be set");
}

export default createConfig({
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.PONDER_RPC_URL_BASE_MAINNET),
    },
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
