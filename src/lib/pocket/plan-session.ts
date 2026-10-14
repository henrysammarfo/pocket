/** Persist approved plan id for a thread across reloads (demo beat). */
const key = (threadId: string) => `pocket:planId:${threadId}`;

export function readStoredPlanId(threadId: string): string | null {
  try {
    return sessionStorage.getItem(key(threadId));
  } catch {
    return null;
  }
}

export function writeStoredPlanId(threadId: string, planId: string | null): void {
  try {
    if (planId) sessionStorage.setItem(key(threadId), planId);
    else sessionStorage.removeItem(key(threadId));
  } catch {
    /* private mode / blocked storage */
  }
}
