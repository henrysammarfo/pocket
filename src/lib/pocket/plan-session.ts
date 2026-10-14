/** Persist approved plan id for a thread across reloads (demo beat). */
const key = (threadId: string) => `pocket:planId:${threadId}`;
const LAST_THREAD = "pocket:lastThread";

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
    sessionStorage.setItem(LAST_THREAD, threadId);
  } catch {
    /* private mode / blocked storage */
  }
}

export function rememberThread(threadId: string): void {
  try {
    sessionStorage.setItem(LAST_THREAD, threadId);
  } catch {
    /* ignore */
  }
}

export function readLastPlanId(): string | null {
  try {
    const t = sessionStorage.getItem(LAST_THREAD);
    return t ? readStoredPlanId(t) : null;
  } catch {
    return null;
  }
}
