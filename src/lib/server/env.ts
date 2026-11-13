import 'server-only';
// Server secrets come only from env. Never log them, never send them to the client.
export type KeyName = 'SPONSOR' | 'RELAYER' | 'MAKER' | 'FAUCET';
export function secretKey(name: KeyName): string | null {
  const v = process.env[`${name}_PRIVATE_KEY`];
  return v && v.startsWith('ed25519:') ? v : null;
}
export const has = (name: KeyName) => secretKey(name) !== null;
export const AI = {
  baseUrl: process.env.AI_BASE_URL || 'https://cloud-api.near.ai/v1',
  apiKey: process.env.AI_API_KEY || process.env.NEARAI_API_KEY || '',
  model: process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V3.1',
};
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const IS_LOCAL = process.env.POCKET_MODE === 'local' || process.env.NODE_ENV !== 'production';
