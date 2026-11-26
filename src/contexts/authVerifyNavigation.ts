import { Paths } from "@/routes/Paths";

function pathOnly(pathname: string) {
  return pathname.split(/[?#]/)[0] ?? "";
}

function isSettingsHubPath(pathname: string) {
  const path = pathOnly(pathname);
  return (
    path === Paths.settings ||
    path.startsWith(`${Paths.settings}/`) ||
    path === "/profile" ||
    path.startsWith("/profile/")
  );
}

/**
 * Recommendation intro/swipe and welcome sit outside AppLayout.
 * VerifyEmailModal is only mounted in AppLayout, so these routes dismiss it.
 */
export function routeUnmountsVerifySheet(pathname: string) {
  const path = pathOnly(pathname);
  return (
    path === Paths.recommend ||
    path.startsWith(`${Paths.recommend}/`) ||
    path === Paths.welcome
  );
}

/**
 * While the verify sheet is open, stay inside AppLayout.
 * Settings is the one hub a new account should leave; Discover keeps the sheet mounted.
 * Null means do not navigate — post-verify routing still runs after the sheet closes.
 */
export function leaveSettingsPathForOpenVerify(
  openedFromRegister: boolean,
  pathname: string,
): string | null {
  if (!openedFromRegister) return null;
  if (!isSettingsHubPath(pathname)) return null;
  return Paths.discover;
}
