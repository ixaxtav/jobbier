import type { PayPeriod, User, WorkMode } from "@/db/schema";
import { annualPay, formatPay, WORK_MODE_LABEL } from "@/lib/format";

type FitJob = { payMin: number | null; payMax: number | null; payPeriod: PayPeriod; workMode: WorkMode | null; currency?: string };
type Prefs = Pick<User, "payFloor" | "payFloorPeriod" | "workModes">;

/**
 * Honest, specific warnings when a job doesn't match what you said you want.
 * The descendant of JobCore's matching (minimum rate, distance, positions) —
 * but it only informs, it never hides anything from you.
 */
export function fitWarnings(job: FitJob, prefs: Prefs): string[] {
  const warnings: string[] = [];

  if (prefs.payFloor != null) {
    const pay = annualPay(job.payMin, job.payMax, job.payPeriod);
    const floor = prefs.payFloorPeriod === "hour" ? prefs.payFloor * 2080 : prefs.payFloor;
    // Compare the top of the range: if even the max is below your floor, say so.
    if (pay != null && pay < floor && (job.currency ?? "USD") === "USD") {
      warnings.push(`Pays below your floor of ${formatPay(prefs.payFloor, prefs.payFloor, prefs.payFloorPeriod)}`);
    }
  }

  if (prefs.workModes.length > 0 && job.workMode && !prefs.workModes.includes(job.workMode)) {
    const wanted = prefs.workModes.map((m) => WORK_MODE_LABEL[m].toLowerCase()).join(" or ");
    warnings.push(`${WORK_MODE_LABEL[job.workMode]}, but you're looking for ${wanted}`);
  }

  return warnings;
}
