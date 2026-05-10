"use client";

import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { removeAvatarAction, uploadAvatarAction } from "../actions";

export function AvatarManager({
  userId,
  name,
  avatarUrl,
}: {
  userId: string;
  name: string;
  avatarUrl?: string;
}) {
  return (
    <AvatarCropper
      name={name}
      currentAvatarUrl={avatarUrl}
      onUpload={async fd => uploadAvatarAction(userId, { ok: false }, fd)}
      onRemove={async () => removeAvatarAction(userId, { ok: false }, new FormData())}
    />
  );
}
