import { pickEvmWallet, type LinkedLike } from "./pick-wallet";
import { PrivyClient } from "@privy-io/node";

export type VerifiedPrivyUser = {
  userId: string;
  email?: string;
  walletAddress?: `0x${string}`;
};

let client: PrivyClient | null = null;

export function getPrivyNodeClient(): PrivyClient | null {
  const appId = process.env["VITE_PRIVY_APP_ID"] || process.env["PRIVY_APP_ID"];
  const appSecret = process.env["PRIVY_APP_SECRET"];
  if (!appId || !appSecret) return null;
  if (!client) {
    const jwtVerificationKey = process.env["PRIVY_JWT_VERIFICATION_KEY"];
    client = new PrivyClient({
      appId,
      appSecret,
      ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
    });
  }
  return client;
}

export function privyConfigured(): boolean {
  return Boolean((process.env["VITE_PRIVY_APP_ID"] || process.env["PRIVY_APP_ID"]) && process.env["PRIVY_APP_SECRET"]);
}

export async function verifyPrivyAccessToken(token: string): Promise<VerifiedPrivyUser | null> {
  const privy = getPrivyNodeClient();
  if (!privy) return null;
  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    const user = await privy.users()._get(claims.user_id);
    const emailAccount = user.linked_accounts?.find((a) => a.type === "email" || a.type === "google_oauth");
    const email =
      emailAccount && "address" in emailAccount
        ? String(emailAccount.address)
        : emailAccount && "email" in emailAccount
          ? String((emailAccount as { email?: string }).email)
          : undefined;
    const walletAccount = pickEvmWallet(user.linked_accounts as unknown as LinkedLike[]);
    const wallet =
      walletAccount
        ? (String(walletAccount.address).trim() as `0x${string}`)
        : undefined;
    const out: VerifiedPrivyUser = { userId: claims.user_id };
    if (email) out.email = email;
    if (wallet) out.walletAddress = wallet;
    return out;
  } catch (e) {
    console.error("[privy] verify failed", e);
    return null;
  }
}
