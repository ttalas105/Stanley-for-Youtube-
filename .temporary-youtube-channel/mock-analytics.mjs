const DAY_MS = 86_400_000;

export const MOCK_AVERAGE_VIEW_MINUTES = Object.freeze({
  7: 5.1,
  30: 5.8,
  90: 6.2,
  180: 6.5,
  365: 6.8,
});

export const MOCK_SUBSCRIBERS_PER_THOUSAND = Object.freeze({
  7: 3.6,
  30: 3.9,
  90: 4.2,
  180: 4.0,
  365: 3.7,
});

export const MOCK_COMPARISON_CHANGES = Object.freeze({
  7: Object.freeze({ views: .18, watchMinutes: .11, netSubscribers: .24 }),
  30: Object.freeze({ views: .14, watchMinutes: .19, netSubscribers: .09 }),
  90: Object.freeze({ views: -.04, watchMinutes: .06, netSubscribers: -.08 }),
  180: Object.freeze({ views: .08, watchMinutes: .03, netSubscribers: .12 }),
  365: Object.freeze({ views: .22, watchMinutes: .17, netSubscribers: .15 }),
});

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function gaussian(index, center, width) {
  return Math.exp(-Math.pow(index - center, 2) / (2 * Math.pow(width, 2)));
}

function distributeExact(total, weights) {
  const safeTotal = Math.max(0, Math.round(total));
  const safeWeights = weights.map((weight) => Math.max(.0001, Number.isFinite(weight) ? weight : 0));
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const exact = safeWeights.map((weight) => safeTotal * weight / weightTotal);
  const values = exact.map(Math.floor);
  const remainder = safeTotal - values.reduce((sum, value) => sum + value, 0);
  const priorities = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remainder; index += 1) values[priorities[index % priorities.length].index] += 1;
  return values;
}

function seriesWeights(pointCount, comparison) {
  const phase = comparison ? 2.35 : 0;
  const viewWeights = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / Math.max(1, pointCount - 1);
    const weeklyRhythm = Math.sin((index + phase) * 1.08) * (comparison ? .08 : .13);
    const longWave = Math.cos((index + (comparison ? 4 : 0)) / 3.1) * .1;
    const firstUpload = gaussian(index, pointCount * (comparison ? .22 : .31), 1.2) * (comparison ? .24 : .62);
    const secondUpload = gaussian(index, pointCount * (comparison ? .68 : .76), 1.6) * (comparison ? .34 : .78);
    const trend = comparison ? 1.03 - progress * .13 : .67 + progress * .46;
    return Math.max(.24, trend + weeklyRhythm + longWave + firstUpload + secondUpload);
  });

  const watchWeights = viewWeights.map((viewWeight, index) => {
    const progress = index / Math.max(1, pointCount - 1);
    const attention = .84 + progress * (comparison ? .05 : .18) + Math.cos((index + phase) * .53) * .1;
    const longFormLift = gaussian(index, pointCount * (comparison ? .61 : .71), 2.3) * .38;
    const shortUploadPenalty = gaussian(index, pointCount * (comparison ? .22 : .31), 1.25) * .18;
    return Math.max(.18, viewWeight * attention + longFormLift - shortUploadPenalty);
  });

  const subscriberWeights = viewWeights.map((viewWeight, index) => {
    const progress = index / Math.max(1, pointCount - 1);
    const delayedViews = viewWeights[Math.max(0, index - 1)];
    const conversionCadence = .56 + Math.sin((index + phase) * .79 + .8) * .13 + progress * (comparison ? -.02 : .16);
    const delayedPeak = gaussian(index, pointCount * (comparison ? .7 : .79), 1.45) * .46;
    return Math.max(.12, viewWeight * .26 + delayedViews * conversionCadence + delayedPeak);
  });

  return { viewWeights, watchWeights, subscriberWeights };
}

export function mockAnalyticsTotals(currentViews, rangeDays) {
  const averageViewMinutes = MOCK_AVERAGE_VIEW_MINUTES[rangeDays] ?? 6.2;
  const subscribersPerThousand = MOCK_SUBSCRIBERS_PER_THOUSAND[rangeDays] ?? 4.0;
  const changes = MOCK_COMPARISON_CHANGES[rangeDays] ?? MOCK_COMPARISON_CHANGES[90];
  const current = {
    views: Math.max(1, Math.round(currentViews)),
    watchMinutes: Math.max(1, Math.round(currentViews * averageViewMinutes)),
    netSubscribers: Math.max(1, Math.round(currentViews * subscribersPerThousand / 1_000)),
  };
  const comparison = {
    views: Math.max(1, Math.round(current.views / (1 + changes.views))),
    watchMinutes: Math.max(1, Math.round(current.watchMinutes / (1 + changes.watchMinutes))),
    netSubscribers: Math.max(1, Math.round(current.netSubscribers / (1 + changes.netSubscribers))),
  };
  return { current, comparison };
}

export function normalizedMockTimeline(totals, rangeDays, comparison = false, now = new Date()) {
  const pointCount = Math.min(42, Math.max(7, rangeDays));
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - rangeDays + 1 - (comparison ? rangeDays : 0));
  const stepDays = (rangeDays - 1) / Math.max(1, pointCount - 1);
  const { viewWeights, watchWeights, subscriberWeights } = seriesWeights(pointCount, comparison);
  const views = distributeExact(totals.views, viewWeights);
  const watchMinutes = distributeExact(totals.watchMinutes, watchWeights);
  const netSubscribers = distributeExact(totals.netSubscribers, subscriberWeights);

  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(start.getTime() + Math.round(index * stepDays) * DAY_MS);
    return {
      date: isoDate(date),
      views: views[index],
      watchMinutes: watchMinutes[index],
      netSubscribers: netSubscribers[index],
    };
  });
}
