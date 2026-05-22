import { requireSuperAdmin } from "@/lib/auth";
import { listSurveyResponses } from "@/lib/survey/store";
import { sampleSurveyResponses } from "@/lib/survey/sample-data";
import { SurveyResults } from "@/components/admin/survey-results";

export const dynamic = "force-dynamic";

/**
 * Customer Feedback — super-admin-only results page for the Customer
 * Experience Survey. Lives under the Customers section of the sidebar.
 *
 * Until real submissions land, the page renders deterministic sample data so
 * the charts and tables aren't empty; `isSample` drives the banner that says
 * as much. As soon as one real response exists, sample data drops out.
 */
export default async function CustomerFeedbackPage() {
  await requireSuperAdmin();

  const real = await listSurveyResponses();
  const isSample = real.length === 0;
  const responses = isSample ? sampleSurveyResponses() : real;

  return (
    <div
      className="page-container page-pad-x page-pad-y space-y-6 sm:space-y-7"
      style={{ maxWidth: "1400px" }}
    >
      <div>
        <p className="text-sm text-muted">Customers</p>
        <h1 className="mt-0.5 font-display text-[clamp(28px,4.6vw,38px)] leading-[1.1] tracking-tight text-foreground">
          Customer Feedback
        </h1>
        <p className="mt-1 text-sm text-muted">
          Customer Experience Survey — Q2 2026. Public form lives at{" "}
          <code className="font-mono text-xs">/q2-2026-survey</code>.
        </p>
      </div>

      <SurveyResults responses={responses} isSample={isSample} />
    </div>
  );
}

export const metadata = {
  title: "Customer Feedback — WB Blends Admin",
};
