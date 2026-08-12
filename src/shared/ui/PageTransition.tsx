/** Stub — collection boot no longer waits on the full page-transition shell. */
export function usePageReady() {
  return {
    markReady: () => {},
    isWaiting: false,
  };
}
