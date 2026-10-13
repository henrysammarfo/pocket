import { usePrivy } from "@privy-io/react-auth";

export function PrivyLoginButton({ onError }: { onError: (msg: string) => void }) {
  const { ready, authenticated, login } = usePrivy();

  if (authenticated) return null;

  return (
    <button
      type="button"
      className="auth-privy"
      disabled={!ready}
      onClick={() => {
        try {
          void Promise.resolve(login()).catch((e: unknown) =>
            onError(e instanceof Error ? e.message : "Privy login failed"),
          );
        } catch (e) {
          onError(e instanceof Error ? e.message : "Privy login failed");
        }
      }}
    >
      Continue — invisible wallet
    </button>
  );
}
