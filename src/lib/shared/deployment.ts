// Public testnet deployment. Contract account ids only, no keys.
// Self hosters: `npm run setup` rewrites deployment/testnet.json for your own root account,
// or set NEXT_PUBLIC_POCKET_ROOT to point the app at another Pocket Pool deployment.
import dep from '../../../deployment/testnet.json';

export type TokenInfo = { symbol: string; name: string; decimals: number; contract: string; assetId: string };

const root = process.env.NEXT_PUBLIC_POCKET_ROOT || dep.root;
const swap = (id: string) => (root === dep.root ? id : id.replace(dep.root, root));

export const NETWORK = 'testnet' as const;
export const ROOT = root;
export const VERIFIER = swap(dep.verifier);
export const MAKER = swap(dep.maker);
export const FAUCET = swap(dep.faucet);
export const RELAYER = swap(dep.relayer);
export const USDC = dep.usdc;
const d2 = dep as typeof dep & { market?: string; walletCodeHash?: string; quoteKey?: string; pool?: string };
/** Pocket private pool: 0.1 NEAR notes, Groth16 proofs checked on chain (contracts/pool). */
export const POOL = d2.pool ? swap(d2.pool) : '';
export const POOL_NOTE_NEAR = '0.1';
/** Pocket maker contract: settles paper trades against signed quotes (contracts/maker). */
export const MARKET = d2.market ? swap(d2.market) : '';
/** Code hash of the Pocket wallet global contract every new account uses (contracts/wallet). */
export const WALLET_CODE_HASH = process.env.NEXT_PUBLIC_WALLET_CODE_HASH || d2.walletCodeHash || '';
export const QUOTE_KEY = d2.quoteKey || '';
export const ONCHAIN_LIMITS = !!(MARKET && WALLET_CODE_HASH);
export const USDC_DECIMALS = 6;
export const VERIFIER_SHA256 = dep.verifierWasmSha256;
export const VERIFIER_RELEASE = dep.verifierRelease;
export const TOKENS: TokenInfo[] = dep.tokens.map((t) => ({ ...t, contract: swap(t.contract), assetId: swap(t.assetId) }));
export const PUSD = TOKENS.find((t) => t.symbol === 'pUSD')!;
export const STOCK_TOKENS = TOKENS.filter((t) => t.symbol !== 'pUSD');
export const tokenBySymbol = (s: string) => TOKENS.find((t) => t.symbol.toLowerCase() === s.toLowerCase());
export const tokenByAsset = (a: string) => TOKENS.find((t) => t.assetId === a);

export const EXPLORER = 'https://testnet.nearblocks.io';
export const txUrl = (h: string) => `${EXPLORER}/txns/${h}`;
export const accountUrl = (a: string) => `${EXPLORER}/address/${a}`;

// Five paper stocks. Price source ids are the live Ondo token prices on CoinGecko,
// and the share price comes from Nasdaq.com. One name everywhere: TSLAon and friends.
export const STOCKS = [
  { token: 'TSLAon', ticker: 'TSLA', name: 'Tesla', logo: 'tesla', cls: 'tsla', cg: 'tesla-ondo-tokenized-stock', asset: 'stocks' },
  { token: 'NVDAon', ticker: 'NVDA', name: 'NVIDIA', logo: 'nvidia', cls: 'nvda', cg: 'nvidia-ondo-tokenized-stock', asset: 'stocks' },
  { token: 'AAPLon', ticker: 'AAPL', name: 'Apple', logo: 'apple', cls: 'aapl', cg: 'apple-ondo-tokenized-stock', asset: 'stocks' },
  { token: 'SPYon', ticker: 'SPY', name: 'S&P 500', logo: 'state-street-mark', cls: 'spy', cg: 'spdr-s-p-500-etf-ondo-tokenized-etf', asset: 'etf' },
  { token: 'QQQon', ticker: 'QQQ', name: 'Nasdaq 100', logo: 'invesco-mark', cls: 'qqq', cg: 'invesco-qqq-etf-ondo-tokenized-etf', asset: 'etf' },
] as const;
export type Stock = (typeof STOCKS)[number];
export const stockByTicker = (t: string) => STOCKS.find((s) => s.ticker.toLowerCase() === t.toLowerCase() || s.token.toLowerCase() === t.toLowerCase());
