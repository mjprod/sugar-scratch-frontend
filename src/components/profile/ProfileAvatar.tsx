import { useState } from "react";

const DEFAULT_AVATAR = "/images/avatars/defaultAvatar";

export function isImageAvatar(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^(https?:)?\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:image/");
}

function DefaultAvatarImg() {
  return (
    <picture>
      <source
        type="image/jxl"
        srcSet={`${DEFAULT_AVATAR}.jxl 1x, ${DEFAULT_AVATAR}@2x.jxl 2x`}
      />
      <source
        type="image/webp"
        srcSet={`${DEFAULT_AVATAR}.webp 1x, ${DEFAULT_AVATAR}@2x.webp 2x`}
      />
      <img
        className="profile-avatar-img"
        src={`${DEFAULT_AVATAR}.webp`}
        srcSet={`${DEFAULT_AVATAR}.webp 1x, ${DEFAULT_AVATAR}@2x.webp 2x`}
        alt=""
        decoding="async"
        draggable={false}
      />
    </picture>
  );
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

  return <DefaultAvatarImg />;
}
