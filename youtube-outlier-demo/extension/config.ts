export const config = Object.freeze({
  longFormMinimumSeconds: 61,
  baselineDirection: Object.freeze({ rising: 0.02, declining: -0.02 }),
  growthAcceleration: Object.freeze({ relative: 0.1, absoluteViewsPerHour: 1 }),
  insightThresholds: Object.freeze({ limitedGroup: 2, limitedPattern: 3, materialLead: 0.1, highConcentration: 0.5, moderateConcentration: 0.3 }),
  durationBuckets: Object.freeze([
    { key: "under-4", label: "Under 4 minutes", min: 0, max: 240 },
    { key: "4-8", label: "4–8 minutes", min: 240, max: 480 },
    { key: "8-12", label: "8–12 minutes", min: 480, max: 720 },
    { key: "12-20", label: "12–20 minutes", min: 720, max: 1200 },
    { key: "20-40", label: "20–40 minutes", min: 1200, max: 2400 },
    { key: "above-40", label: "Above 40 minutes", min: 2400, max: Infinity },
  ]),
  titleLengthBuckets: Object.freeze([
    { key: "under-30", label: "Under 30 characters", min: 0, max: 30 },
    { key: "30-50", label: "30–50", min: 30, max: 51 },
    { key: "51-70", label: "51–70", min: 51, max: 71 },
    { key: "above-70", label: "Above 70", min: 71, max: Infinity },
  ]),
  weekdays: Object.freeze(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
  outlierBuckets: Object.freeze([
    { key: "below-0.5", label: "Below 0.5x", min: -Infinity, max: 0.5 },
    { key: "0.5-1", label: "0.5x-1x", min: 0.5, max: 1 },
    { key: "1-2", label: "1x-2x", min: 1, max: 2 },
    { key: "2-5", label: "2x-5x", min: 2, max: 5 },
    { key: "5-10", label: "5x-10x", min: 5, max: 10 },
    { key: "above-10", label: "Above 10x", min: 10, max: Infinity },
  ]),
});
