import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
const { NEYNAR_API_KEY } = process.env;

if (!NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not set");
}

const config = new Configuration({
  apiKey: NEYNAR_API_KEY!,
});

const neynarClient = new NeynarAPIClient(config);

export default neynarClient;
