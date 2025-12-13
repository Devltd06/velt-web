// lib/navigation.ts
// Safe navigation helpers to prevent duplicate rapid navigations.
let _lastNavKey: string | null = null;
let _lastNavAt = 0;
const DEDUPE_MS = 1000; // ignore duplicate navigations within this window (increased from 800)

function normalizeTarget(target: any) {
  try {
    if (typeof target === 'string') return target;
    return JSON.stringify(target);
  } catch {
    return String(target);
  }
}

export function safePush(router: any, target: any) {
  try {
    const key = normalizeTarget(target);
    const now = Date.now();
    if (_lastNavKey === key && now - _lastNavAt < DEDUPE_MS) {
      // ignore duplicate rapid navigation
      console.debug('[navigation] blocked duplicate push:', key);
      return;
    }
    _lastNavKey = key;
    _lastNavAt = now;
    return router.push(target);
  } catch (e) {
    try { return router.push(target); } catch { /* swallow */ }
  }
}

export function safeReplace(router: any, target: any) {
  try {
    const key = normalizeTarget(target);
    const now = Date.now();
    if (_lastNavKey === key && now - _lastNavAt < DEDUPE_MS) {
      console.debug('[navigation] blocked duplicate replace:', key);
      return;
    }
    _lastNavKey = key;
    _lastNavAt = now;
    return router.replace(target);
  } catch (e) {
    try { return router.replace(target); } catch { /* swallow */ }
  }
}

export function safeBack(router: any) {
  try {
    const now = Date.now();
    if (_lastNavKey === '__back__' && now - _lastNavAt < DEDUPE_MS) {
      console.debug('[navigation] blocked duplicate back');
      return;
    }
    _lastNavKey = '__back__';
    _lastNavAt = now;
    return router.back();
  } catch (e) {
    try { return router.back(); } catch { /* swallow */ }
  }
}

export function resetNavDedupe() {
  _lastNavKey = null;
  _lastNavAt = 0;
}

export default { safePush, safeReplace, safeBack, resetNavDedupe };

export function withSafeRouter(router: any) {
  if (!router) return router;
  return {
    ...router,
    push: (target: any) => safePush(router, target),
    replace: (target: any) => safeReplace(router, target),
    back: () => safeBack(router),
  } as any;
}
