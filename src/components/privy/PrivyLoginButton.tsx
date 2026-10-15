import { usePrivy } from "@privy-io/react-auth";

export function PrivyLoginButton({
  onError,
  label = "Continue",
  className = "pk-btn-primary auth-beebah-continue",
}: {
  onError: (msg: string) => void;
  label?: string;
  className?: string;
}) {
  const { ready, authenticated, login } = usePrivy();

  if (authenticated) return null;

  return (
    <button
      type="button"
      className={className}
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
      {label}
    </button>
  );
}
