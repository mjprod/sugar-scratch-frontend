/** Guest deep-link on a gated route should open login. Logout should not. */
export function shouldPromptLoginOnSoftGate(
  authReady: boolean,
  authed: boolean,
  wasAuthed: boolean,
): boolean {
  return authReady && !authed && !wasAuthed;
}
