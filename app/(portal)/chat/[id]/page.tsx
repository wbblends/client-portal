import { requireSession } from "@/lib/auth";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  return <ChatShell viewerId={user.id} viewerRole={user.role} activeId={id} />;
}
