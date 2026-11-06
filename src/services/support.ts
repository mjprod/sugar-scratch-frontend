import { ApiError, apiMutate } from "@/lib/api";
import {
  supportMailto,
  type SupportDraft,
} from "@/content/helpCenter";

export type SupportSubmitResult =
  | { ok: true }
  | { ok: false; message: string; mailto: string };

/**
 * Public support request. Guests can submit; the session cookie is sent
 * when they are signed in. Fail closed — the caller offers the mailto.
 */
export async function submitSupportRequest(
  draft: SupportDraft,
): Promise<SupportSubmitResult> {
  const mailto = supportMailto(draft);
  try {
    await apiMutate<{ ok?: boolean }>("/api/support", {
      method: "POST",
      body: JSON.stringify({
        topic: draft.topic,
        email: draft.email.trim(),
        message: draft.message.trim(),
        account_id: draft.accountId.trim(),
        transaction_ref: draft.transactionRef.trim(),
        report_target: draft.reportTarget.trim(),
        app_version: draft.appVersion,
      }),
    });
    return { ok: true };
  } catch (error) {
    const unreachable =
      error instanceof ApiError &&
      (error.status === 404 || error.status === 405 || error.status === 501);
    return {
      ok: false,
      message: unreachable
        ? "We couldn’t send this from the app. Email it instead."
        : "We couldn’t send your message. Try again, or email it instead.",
      mailto,
    };
  }
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Starts account deletion for the signed-in session. The server revokes
 * Sign in with Apple when that was the credential. Does not refund charges.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    await apiMutate("/api/me/account/delete", {
      method: "POST",
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return {
        ok: false,
        message: "Sign in again, then confirm deletion.",
      };
    }
    return {
      ok: false,
      message:
        "Account deletion could not be completed. Try again, or email privacy@sugarscratch.com from the address on this account.",
    };
  }
}
