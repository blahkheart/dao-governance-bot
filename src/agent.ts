import neynarClient from "./neynarClient";
import {
SIGNER_UUID,
  NEYNAR_API_KEY,
} from "./config";
import { isApiErrorResponse } from "@neynar/nodejs-sdk";

// Validating necessary environment variables or configurations.
if (!SIGNER_UUID) {
  throw new Error("SIGNER_UUID is not defined");
}

if (!NEYNAR_API_KEY) {
  throw new Error("NEYNAR_API_KEY is not defined");
}
export interface FarcasterBot {
  publishCast: (text: string) => Promise<void>;
}

export function createFarcasterBot(): FarcasterBot {
  return {
    async publishCast(text: string) {
      try {
        await neynarClient.publishCast({ signerUuid: SIGNER_UUID, text });
        console.log("Cast published successfully");
      } catch (err) {
        if (isApiErrorResponse(err)) {
          console.log(err.response.data);
        } else console.log(err);
      }
    },
  };
}