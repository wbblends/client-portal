"use client";

import { AvatarCropper } from "@/components/ui/avatar-cropper";
import { removeMyAvatarAction, uploadMyAvatarAction } from "../actions";

export function MyAvatarManager({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return (
    <AvatarCropper
      name={name}
      currentAvatarUrl={avatarUrl}
      onUpload={async fd => uploadMyAvatarAction({ ok: false }, fd)}
      onRemove={async () => removeMyAvatarAction({ ok: false }, new FormData())}
    />
  );
}
