"use client";

import { useEffect, useState } from "react";

/**
 * Time-of-day welcome shown above the login form for returning users.
 * The greeting is computed from the user's local clock after mount so it
 * matches what they'd expect, rather than the server's UTC.
 */
export function LoginGreeting({ firstName }: { firstName: string }) {
  const [greeting, setGreeting] = useState<string>("Welcome back");

  useEffect(() => {
    setGreeting(pickGreeting(new Date()));
  }, []);

  return (
    <p className="text-[15px] text-muted-soft">
      <span suppressHydrationWarning>{greeting}</span>,{" "}
      <span className="font-medium text-foreground">{firstName}</span>.
    </p>
  );
}

function pickGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Late night session";
}
