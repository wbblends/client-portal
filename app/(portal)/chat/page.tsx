import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listConversations } from "@/lib/chat/repository";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireSession();
  // Open the most-recent conversation automatically so the right pane is
  // immediately useful (like Outlook / Gmail). If the user has no
  // conversations yet, render the empty state.
  const conversations = listConversations(user);
  if (conversations.length > 0) {
    redirect(`/chat/${conversations[0].id}`);
  }
  return <ChatShell viewerId={user.id} viewerRole={user.role} activeId={null} />;
}
