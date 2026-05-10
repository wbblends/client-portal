"use client";

import { useEffect, useState } from "react";

/**
 * Personalized welcome shown above the login form for returning users.
 *
 * Picks from a pool of greetings flavored by the local hour, day of week,
 * and a few calendar moments. Randomized per page load so it feels fresh,
 * the way Claude Code's startup greeting does.
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
  const pool = buildPool(now);
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildPool(now: Date): string[] {
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun … 6 = Sat
  const month = now.getMonth();
  const date = now.getDate();

  // Time-of-day always contributes — that's the main flavor.
  const timeOfDay = hour >= 5 && hour < 12
    ? MORNING
    : hour >= 12 && hour < 17
      ? AFTERNOON
      : hour >= 17 && hour < 22
        ? EVENING
        : LATE_NIGHT;

  const pool: string[] = [...timeOfDay, ...GENERIC];

  if (day === 1) pool.push(...MONDAY);
  if (day === 3) pool.push(...WEDNESDAY);
  if (day === 5) pool.push(...FRIDAY);
  if (day === 0 || day === 6) pool.push(...WEEKEND);

  // A few calendar moments — kept rare and obvious so they feel like flair,
  // not gimmicks.
  if (month === 0 && date <= 7) pool.push("Happy New Year");
  if (month === 11 && date >= 20 && date <= 26) pool.push("Happy holidays");
  if (month === 9 && date === 31) pool.push("Happy Halloween");

  return pool;
}

const MORNING = [
  "Good morning",
  "Morning",
  "Rise and shine",
  "Bright and early",
  "Top of the morning",
  "Fresh start",
];

const AFTERNOON = [
  "Good afternoon",
  "Afternoon",
  "Hope the day's going well",
  "Mid-day check-in",
];

const EVENING = [
  "Good evening",
  "Evening",
  "Winding down",
  "Hope you had a good day",
];

const LATE_NIGHT = [
  "Late night session",
  "Burning the midnight oil",
  "Still up",
  "Working late",
  "Night owl mode",
];

const GENERIC = [
  "Welcome back",
  "Good to see you",
  "Glad you're back",
  "Hey again",
];

const MONDAY = ["Happy Monday", "New week"];
const WEDNESDAY = ["Happy hump day"];
const FRIDAY = ["Happy Friday", "TGIF", "Almost the weekend"];
const WEEKEND = ["Happy weekend", "Hope you're having a good weekend"];
