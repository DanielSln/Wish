import { digest, CryptoDigestAlgorithm } from 'expo-crypto';
export async function backupHash(bytes: Uint8Array) { const value = await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes).buffer); return Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join(''); }
