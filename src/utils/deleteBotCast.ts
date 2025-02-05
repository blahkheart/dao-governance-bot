import { SIGNER_UUID } from "../config";
import { logger } from '../utils/logger'; 
import neynarClient from "../neynarClient";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY; // Store securely in .env
const NEYNAR_DELETE_CAST_URL = 'https://api.neynar.com/v2/farcaster/cast';

/**
 * Deletes a cast published by the bot using Neynar API.
 * @param castHash - The unique hash of the cast to be deleted.
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise.
 */
export async function deleteBotCastViaApi(castHash: string): Promise<boolean> {
  if (!NEYNAR_API_KEY) {
    logger.error('Missing Neynar API Key');
    throw new Error('Neynar API Key is required.');
  }

  try {
    const response = await fetch(NEYNAR_DELETE_CAST_URL, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${NEYNAR_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ castHash }) // The cast hash to delete
    });

    if (response.ok) {
      logger.info(`Successfully deleted cast: ${castHash}`);
      return true;
    } else {
      const errorText = await response.text();
      logger.warn(`Failed to delete cast: ${castHash}. Status: ${response.status} - ${errorText}`);
      return false;
    }
  } catch (error: any) {
    logger.error(`Error deleting cast: ${castHash}`, error.message);
    return false;
  }
}


async function deleteCast(castHash: string) {  
  try {
    // Get signer's FID first
    const signer = await neynarClient.lookupSigner({ signerUuid: SIGNER_UUID });
    if (!signer?.fid) {
      throw new Error('Signer FID not found');
    }

    // delete cast
    const response = await neynarClient.deleteCast({
      signerUuid: SIGNER_UUID,
      targetHash: castHash
    });

    logger.info('Successfully deleted cast:', JSON.stringify(response, null, 2));

  } catch (error) {
    logger.error('Failed to fetch casts:', error);
    process.exit(1);
  }
}

// Execute if this script is run directly
if (require.main === module) {
  const castHash = process.argv[2];
  if (!castHash) {
    console.error('Please provide a cast hash as an argument');
    console.log('Usage: yarn delete:cast <castHash>');
    process.exit(1);
  }
  deleteCast(castHash);
}