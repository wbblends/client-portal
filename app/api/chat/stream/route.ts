import { getSession } from "@/lib/auth";
import { subscribe } from "@/lib/chat/events";
import { db } from "@/lib/db";
import type { ChatEvent } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events: per-user push channel. The client connects once and
 * receives any chat event the viewer has visibility into (i.e., they're a
 * member of the conversation involved). Heartbeat comments keep proxies happy.
 */
export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const userId = user.id;
  const isMemberStmt = db().prepare(
    "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
  );
  const isMember = (cid: string) => !!isMemberStmt.get(cid, userId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          /* connection closed */
        }
      };

      send(`: hi\n\n`);
      const heartbeat = setInterval(() => send(`: keepalive\n\n`), 25_000);

      const unsubscribe = subscribe((event: ChatEvent) => {
        const cid =
          "conversationId" in event
            ? event.conversationId
            : event.conversation.id;
        if (!isMember(cid)) return;
        send(`event: chat\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const onAbort = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
