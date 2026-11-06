import { ApiError, apiMutate } from "@/lib/api";
import {
  DELETE_ACCOUNT_CONFIRM,
  supportMailto,
  type SupportDraft,
} from "@/content/helpCenter";

export type SupportSubmitResult =
  | { ok: true }
  | { ok: false; message: string; mailto: string };

/** Explicit `{ ok: false }` on a 2xx body. Null means the mutation succeeded. */
export function explicitFailureDetail(body: unknown): string | null {
  if (!body || typeof body !== "object" || (body as { ok?: unknown }).ok !== false) {
    return null;
  }
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail.trim() : "";
}

/**
 * Public support request. Guests can submit; the session cookie is sent
 * when they are signed in. Fail closed — the caller offers the mailto.
 */
export async function submitSupportRequest(
  draft: SupportDraft,
): Promise<SupportSubmitResult> {
  const mailto = supportMailto(draft);
  const failed = "We couldn’t send your message. Try again, or email it instead.";
  try {
    const result = await apiMutate<{ ok?: boolean; detail?: string }>("/api/support", {
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
    const detail = explicitFailureDetail(result);
    if (detail !== null) {
      return { ok: false, message: detail || failed, mailto };
    }
    return { ok: true };
  } catch (error) {
    const unreachable =
      error instanceof ApiError &&
      (error.status === 404 || error.status === 405 || error.status === 501);
    return {
      ok: false,
      message: unreachable
        ? "We couldn’t send this from the app. Email it instead."
        : failed,
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
  const failed =
    "Account deletion could not be completed. Try again, or email privacy@sugarscratch.com from the address on this account.";
  try {
    const result = await apiMutate<{ ok?: boolean; detail?: string }>(
      "/api/me/account/delete",
      {
        method: "POST",
        body: JSON.stringify({ confirm: DELETE_ACCOUNT_CONFIRM }),
      },
    );
    const detail = explicitFailureDetail(result);
    if (detail !== null) {
      return {
        ok: false,
        message: detail || failed,
      };
    }
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
      message: failed,
    };
  }
}
