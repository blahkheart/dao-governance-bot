import { logger } from "./logger";
import neynarClient from "../neynarClient";
import { deleteCast } from "./deleteBotCast";

const castHashes = [
  '0xb4a349f0deab461a787bde0f42d121c1f68da781',
]

const { SIGNER_UUID } = process.env;

if (!SIGNER_UUID) {
  throw new Error("SIGNER_UUID is not set");
}

async function viewCasts() {
  try {
    // Get signer's FID first
    const signer = await neynarClient.lookupSigner({ signerUuid: SIGNER_UUID });
    if (!signer?.fid) {
      throw new Error('Signer FID not found');
    }

    // Fetch casts for the FID
    const response = await neynarClient.fetchCastsForUser({
      fid: signer.fid,
      limit: 20 // Adjust as needed
    });

    console.log('\nRecent Casts:\n');
    response.casts.forEach(async (cast, index) => {
      console.log(`${index + 1}. [${new Date(cast.timestamp).toLocaleString()}]`);
      console.log(`Text: ${cast.text}`);
      console.log(`Hash: ${cast.hash}`);
      console.log('---\n');
      castHashes.push(cast.hash);
      console.log(`Hashes: ${castHashes}`);
    });

    castHashes.forEach(async (hash) => {
      await deleteCast(hash);
      console.log(`Deleted cast: ${hash}`);
    });

  } catch (error) {
    logger.error('Failed to fetch casts:', error);
    process.exit(1);
  }
}

// Execute if this file is run directly
viewCasts(); 