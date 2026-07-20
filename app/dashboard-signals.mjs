export function findDiscoveryGrowth(traffic = [], comparisonTraffic = [], minimumCurrentShare = 5) {
  const currentTotal = traffic.reduce((sum, source) => sum + Number(source.views || 0), 0);
  const comparisonTotal = comparisonTraffic.reduce((sum, source) => sum + Number(source.views || 0), 0);
  if (!currentTotal || !comparisonTotal) return null;

  const comparisonBySource = new Map(comparisonTraffic.map((source) => [source.source, source]));
  return traffic
    .map((source) => {
      const currentShare = (Number(source.views || 0) / currentTotal) * 100;
      const previousShare = (Number(comparisonBySource.get(source.source)?.views || 0) / comparisonTotal) * 100;
      return { source, currentShare, previousShare, shareChange: currentShare - previousShare };
    })
    .filter((candidate) => candidate.currentShare >= minimumCurrentShare)
    .sort((left, right) => right.shareChange - left.shareChange)[0] || null;
}
