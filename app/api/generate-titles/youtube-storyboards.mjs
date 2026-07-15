export function storyboardSheetUrls(spec, maxSheets = 6) {
  if (typeof spec !== "string" || !spec.startsWith("https://i.ytimg.com/sb/")) return [];
  const [template, ...rawLevels] = spec.split("|");
  if (!template.includes("$L") || !template.includes("$N")) return [];

  const levels = rawLevels.flatMap((raw, index) => {
    const [width, height, count, columns, rows, intervalMs, name, signature] = raw.split("#");
    const numeric = [width, height, count, columns, rows, intervalMs].map(Number);
    if (numeric.some((value) => !Number.isFinite(value)) || !name || !signature) return [];
    return [{
      index,
      width: numeric[0],
      count: numeric[2],
      columns: numeric[3],
      rows: numeric[4],
      name,
      signature,
    }];
  });
  if (!levels.length) return [];

  const preferred = levels.at(-1);
  if (!preferred) return [];
  const framesPerSheet = Math.max(1, preferred.columns * preferred.rows);
  const sheetCount = Math.max(1, Math.ceil(preferred.count / framesPerSheet));
  const outputCount = Math.min(Math.max(1, maxSheets), sheetCount);
  const indices = Array.from({ length: outputCount }, (_, index) => outputCount === 1
    ? 0
    : Math.round((index * (sheetCount - 1)) / (outputCount - 1)));

  return Array.from(new Set(indices)).flatMap((sheetIndex) => {
    const fileName = preferred.name.includes("$M")
      ? preferred.name.replace("$M", String(sheetIndex))
      : preferred.name === "default" ? "default" : `M${sheetIndex}`;
    const rawUrl = template
      .replace("$L", String(preferred.index))
      .replace("$N", fileName);
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || url.hostname !== "i.ytimg.com") return [];
      url.searchParams.set("sigh", preferred.signature);
      return [url.toString()];
    } catch {
      return [];
    }
  });
}
