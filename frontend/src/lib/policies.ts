/**
 * Resolve public `policies.*` settings with hardcoded fallbacks from data/policies.ts.
 */
import { policyDefaults, type PolicyValues } from "../data/policies";
import { useSettings } from "./settings";

const keyMap: Record<keyof PolicyValues, string> = {
  deliveryDays: "policies.deliveryDays",
  expressPercent: "policies.expressPercent",
  expressMaxPhotos: "policies.expressMaxPhotos",
  extraImageKobo: "policies.extraImageKobo",
  vatPercent: "policies.vatPercent",
  accompanyingMax: "policies.accompanyingMax",
  reschedulePercent: "policies.reschedulePercent",
  onlineDiscountPercent: "policies.onlineDiscountPercent",
};

/** Seeded aliases when admin/DB uses a different key than the public pages. */
const keyAliases: Partial<Record<keyof PolicyValues, string>> = {
  reschedulePercent: "policies.rescheduleFeePercent",
};

export function usePolicyValues(): PolicyValues {
  const { get } = useSettings();
  const values = {} as PolicyValues;
  for (const key of Object.keys(policyDefaults) as (keyof PolicyValues)[]) {
    const primary = get(keyMap[key], "");
    const aliased = keyAliases[key] ? get(keyAliases[key]!, "") : "";
    values[key] = primary || aliased || policyDefaults[key];
  }
  return values;
}

export function formatExtraImageNaira(koboStr: string): string {
  const kobo = Number(koboStr);
  if (!Number.isFinite(kobo)) return "₦3,000";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
