import { useState } from "react";

const FALLBACK_AVATAR = "✨";

export function isImageAvatar(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^(https?:)?\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image/");
}

export function ProfileAvatar({ value }: { value: string | null | undefined }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (isImageAvatar(value) && failedSrc !== value) {
    return (
      <img
        className="profile-avatar-img"
        src={value}
        alt=""
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(value)}
      />
    );
  }

  return <>{isImageAvatar(value) ? FALLBACK_AVATAR : value || FALLBACK_AVATAR}</>;
}
