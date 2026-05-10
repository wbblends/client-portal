import { requireSession } from "@/lib/auth";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireSession();
  return <ChatShell viewerId={user.id} viewerRole={user.role} activeId={null} />;
}
