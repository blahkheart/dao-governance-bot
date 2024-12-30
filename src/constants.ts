export const WS_RPC_URL = `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

export const RPC = {
  8453: {
    url: WS_RPC_URL,
    traceAPI: "geth",
  },
};

export const ETHERSCAN_ENDPOINT = "https://basescan.org";
export const FARCASTER_HUB_URL = "https://hub.farcaster.standardcrypto.vc:2281";
