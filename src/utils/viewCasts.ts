import { SIGNER_UUID } from "../config";
import { logger } from "./logger";
import neynarClient from "../neynarClient";
// import { deleteCast } from "./deleteBotCast";

const castHashes = ['0xb4a349f0deab461a787bde0f42d121c1f68da781']

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
    });

    // castHashes.forEach(async (hash) => {
    //   await deleteCast(hash);
    // });

  } catch (error) {
    logger.error('Failed to fetch casts:', error);
    process.exit(1);
  }
}

// Execute if this script is run directly
if (require.main === module) {
  viewCasts();
} 