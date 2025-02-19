import { SIGNER_UUID } from "../config";
import { logger } from '../utils/logger'; 
import neynarClient from "../neynarClient";

export async function publishCast(text: string): Promise<boolean> {  
  try {
    // Get signer's FID first
    const signer = await neynarClient.lookupSigner({ signerUuid: SIGNER_UUID });
    if (!signer?.fid) {
      throw new Error('Signer FID not found');
    }

    // publish cast
    const response = await neynarClient.publishCast({
        signerUuid: SIGNER_UUID,
        text
    });

    logger.info('Successfully published cast:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    logger.error('Failed to publish cast:', error);
    return false;
  }
}
