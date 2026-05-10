import Image from "next/image";
import { cn } from "@/lib/utils";

export function ChatAvatar({
  name,
  src,
  color,
  size = 36,
  className,
}: {
  name: string;
  src?: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-border",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color || "var(--color-primary)",
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials || "?"}
    </div>
  );
}

export function GroupAvatar({
  members,
  size = 36,
  className,
}: {
  members: Array<{ name: string; avatarUrl?: string; avatarColor?: string }>;
  size?: number;
  className?: string;
}) {
  // Show up to 2 stacked avatars at half size for groups/channels.
  const sample = members.slice(0, 2);
  if (sample.length < 2) {
    return (
      <ChatAvatar
        name={sample[0]?.name ?? "?"}
        src={sample[0]?.avatarUrl}
        color={sample[0]?.avatarColor}
        size={size}
        className={className}
      />
    );
  }
  const inner = Math.round(size * 0.7);
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <ChatAvatar
        name={sample[1].name}
        src={sample[1].avatarUrl}
        color={sample[1].avatarColor}
        size={inner}
        className="absolute right-0 bottom-0 ring-2 ring-card"
      />
      <ChatAvatar
        name={sample[0].name}
        src={sample[0].avatarUrl}
        color={sample[0].avatarColor}
        size={inner}
        className="absolute left-0 top-0 ring-2 ring-card"
      />
    </div>
  );
}
