"use client";

import { useActionState, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  removeMyAvatarAction,
  uploadMyAvatarAction,
  type AccountActionResult,
} from "../actions";
import { FormStatus } from "./form-status";

const INITIAL: AccountActionResult = { ok: false };

export function MyAvatarManager({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [uploadState, uploadFormAction, uploading] = useActionState(uploadMyAvatarAction, INITIAL);
  const [removeState, removeFormAction, removing] = useActionState(removeMyAvatarAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [hasFile, setHasFile] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={avatarUrl} size={72} />
        <div className="text-sm">
          <div className="font-medium text-foreground">
            {avatarUrl ? "Custom photo" : "Initials placeholder"}
          </div>
          <div className="text-muted text-xs mt-0.5">
            {avatarUrl ? "Upload to replace it." : "Upload an image to replace the initials."}
          </div>
        </div>
      </div>

      <form
        ref={formRef}
        action={uploadFormAction}
        className="space-y-3"
        onChange={() => {
          const f = formRef.current?.elements.namedItem("avatar") as HTMLInputElement | null;
          setHasFile(!!f?.files?.length);
        }}
      >
        <label className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-accent/30 p-4 text-center cursor-pointer hover:border-border-strong hover:bg-accent/60 transition-colors">
          <Upload className="h-5 w-5 text-muted mx-auto" />
          <div className="text-sm font-medium text-foreground-soft">Choose image</div>
          <div className="text-xs text-muted">PNG, JPEG, WebP, GIF · up to 2 MB</div>
          <input
            type="file"
            name="avatar"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
          />
        </label>
        <Button type="submit" size="sm" className="w-full" disabled={!hasFile || uploading}>
          {uploading ? "Uploading…" : "Upload photo"}
        </Button>
      </form>

      <FormStatus ok={uploadState.ok} message={uploadState.message} />

      {avatarUrl && (
        <form action={removeFormAction}>
          <Button type="submit" variant="outline" size="sm" className="w-full" disabled={removing}>
            <Trash2 className="h-4 w-4" />
            {removing ? "Removing…" : "Remove photo"}
          </Button>
          <FormStatus ok={removeState.ok} message={removeState.message} className="mt-2" />
        </form>
      )}
    </div>
  );
}
