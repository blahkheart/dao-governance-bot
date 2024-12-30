import dotenv from "dotenv";
dotenv.config();

const FARCASTER_BOT_MNEMONIC = process.env.FARCASTER_BOT_MNEMONIC!;
const SIGNER_UUID = process.env.SIGNER_UUID!;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY!;
const PUBLISH_CAST_TIME = process.env.PUBLISH_CAST_TIME || "09:00";
const TIME_ZONE = process.env.TIME_ZONE || "UTC";
const MONGODB_URI = process.env.MONGODB_URI!;
const PORT = process.env.PORT || 3000;
const DAO_GOVERNOR_ADDRESS = process.env.DAO_GOVERNOR_ADDRESS!;
const ERC20_ADDRESS = process.env.ERC20_ADDRESS!;

if (!FARCASTER_BOT_MNEMONIC || !SIGNER_UUID || !NEYNAR_API_KEY || !MONGODB_URI || !DAO_GOVERNOR_ADDRESS || !ERC20_ADDRESS) {
    throw new Error("Missing environment variables");
}

export {
    FARCASTER_BOT_MNEMONIC,
    SIGNER_UUID,
    NEYNAR_API_KEY,
    PUBLISH_CAST_TIME,
    TIME_ZONE,
    MONGODB_URI,
    PORT,
    DAO_GOVERNOR_ADDRESS,
    ERC20_ADDRESS
};