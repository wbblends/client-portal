import { requireSession } from "@/lib/auth";

// Greeting templates rotate on every refresh. The page is already dynamic
// (requireSession reads cookies), so Math.random() runs per request.
const GREETINGS: ((n: string) => string)[] = [
  (n) => `Welcome back to the synergy zone, ${n}...`,
  (n) => `${n}, ready to move the needle today...`,
  (n) => `Greetings, ${n} — let's circle back to greatness...`,
  (n) => `${n}, time to leverage some core competencies...`,
  (n) => `Look who's pivoting into the office — hey, ${n}...`,
  (n) => `${n}, your bandwidth is looking impeccable today...`,
  (n) => `Welcome, ${n} — let's unpack today's deliverables...`,
  (n) => `${n}, the KPIs missed you...`,
  (n) => `Reporting for synergy, ${n}...`,
  (n) => `${n}, ready to disrupt some paradigms...`,
  (n) => `Welcome aboard, ${n} — the deck has been pre-aligned...`,
  (n) => `${n}, let's take this one offline... but in here...`,
  (n) => `Hot off the standup, ${n} — what's our north star today...`,
  (n) => `${n}, you're absolutely crushing the optics...`,
  (n) => `Greetings, ${n} — synergies are tracking ahead of plan...`,
  (n) => `${n}, the action items have been waiting...`,
  (n) => `Welcome, ${n} — let's blue-sky this one...`,
  (n) => `${n}, ready to right-size some workflows...`,
  (n) => `Look alive, ${n} — the runway is wide open...`,
  (n) => `${n}, your stakeholder energy is unmatched today...`,
  (n) => `Welcome, ${n} — we've got the green light on all fronts...`,
  (n) => `${n}, let's drill down and double-click on today...`,
  (n) => `Top of the funnel to you, ${n}...`,
  (n) => `${n}, the low-hanging fruit awaits...`,
  (n) => `Welcome, ${n} — let's table-stakes this morning...`,
  (n) => `${n}, your value-add is showing...`,
  (n) => `Greetings, ${n} — let's get our ducks in a row...`,
  (n) => `${n}, time to operationalize the vision...`,
  (n) => `Welcome, ${n} — consider the loop officially closed...`,
  (n) => `${n}, you're moving needles I didn't even know existed...`,
  (n) => `Glad you could join the standup, ${n}...`,
  (n) => `${n}, let's punch above our weight class today...`,
  (n) => `Welcome, ${n} — the deliverables are crisp...`,
  (n) => `${n}, bandwidth permitting, today looks promising...`,
  (n) => `Hey ${n} — quick gut-check: ready to win the day...`,
];

export default async function HomePage() {
  const user = await requireSession();
  const firstName = user.name.split(" ")[0];
  const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName);

  return (
    <div className="page-container page-pad-x page-pad-y">
      <h1 className="font-display text-3xl tracking-tight text-foreground">
        {greeting}
      </h1>
    </div>
  );
}
