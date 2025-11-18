#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [, , inputPath, jsonOutputPath, mdOutputPath, csvOutputPath] = process.argv;

if (!inputPath || !jsonOutputPath || !mdOutputPath || !csvOutputPath) {
  console.error(
    "Usage: node scripts/generate-extended-metrics-md.js <collection.json> <output.json> <output.md> <output.csv>"
  );
  process.exit(1);
}

const readJson = (filePath) => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Input file not found: ${absolutePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
};

const formatMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) return "n/a";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = Math.abs(rounded % 60);
  if (Math.abs(hours) < 1) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
};

const formatNumber = (value, fractionDigits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return Number(value).toFixed(fractionDigits);
};

const formatSizeMix = (counts = {}) => {
  const small = counts.small || 0;
  const medium = counts.medium || 0;
  const large = counts.large || 0;
  return `S:${small} / M:${medium} / L:${large}`;
};

const coerceNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const writeFile = (filePath, contents) => {
  fs.writeFileSync(path.resolve(process.cwd(), filePath), contents, "utf-8");
};

const createMermaidChart = (title, yAxisLabel, seriesLabel, values) => {
  if (!values.length) return "";
  const xAxis = values.map(({ label }) => `"${label}"`).join(", ");
  const barValues = values.map(({ value }) => value ?? 0).join(", ");
  return `\`\`\`mermaid
---
config:
    xyChart:
        width: 900
        height: 400
---
xychart-beta
    title "${title}"
    x-axis [${xAxis}]
    y-axis "${yAxisLabel}"
    bar ${seriesLabel} [${barValues}]
\`\`\`
`;
};

const collection = readJson(inputPath);
const developers = Object.keys(collection).filter(
  (key) => key !== "total" && collection[key]?.total?.extendedMetrics
);

const metricsByDeveloper = developers.reduce((acc, developer) => {
  const extended = collection[developer].total.extendedMetrics || {};
  acc[developer] = {
    cycleTimeMinutes: coerceNumber(extended.cycleTimeFromFirstCommitAverage),
    prThroughput: extended.prThroughput ?? 0,
    averageCodingTimeMinutes: coerceNumber(extended.averageCodingTime),
    reviewWaitingTimeMinutes: coerceNumber(extended.reviewWaitingTimeAverage),
    reviewTimeMinutes: coerceNumber(extended.reviewTimeAverage),
    totalComments: extended.totalComments ?? 0,
    sizeCategoryCounts: extended.prSizeCategoryCounts || {
      small: 0,
      medium: 0,
      large: 0,
    },
    averageCommentsPerPr: coerceNumber(extended.averageCommentsPerPr),
    requestedChangesCount: extended.requestedChangesCount ?? 0,
    timeToAddressChangesMinutes: coerceNumber(
      extended.timeToAddressChangesAverage
    ),
    averageLocAdded: coerceNumber(extended.averageLocAdded),
    averageLocDeleted: coerceNumber(extended.averageLocDeleted),
    averageFilesChanged: coerceNumber(extended.averageFilesChanged),
    prsWithoutReview: extended.prsWithoutReview ?? 0,
    prsWithoutApproval: extended.prsWithoutApproval ?? 0,
  };
  return acc;
}, {});

writeFile(jsonOutputPath, JSON.stringify(metricsByDeveloper, null, 2));

const headers = [
  "Developer",
  "Cycle Time",
  "PR Throughput",
  "Average Coding Time",
  "Review Waiting Time",
  "Review Time",
  "Total Comments",
  "PR Size Mix",
  "Avg Comments / PR",
  "Requested Changes",
  "Time to Address Changes",
  "Average LOC +/-",
  "Average Files Changed",
  "PRs w/o Review",
  "PRs w/o Approval",
];

const formatAverageLoc = (data) =>
  data.averageLocAdded !== null || data.averageLocDeleted !== null
    ? `+${formatNumber(data.averageLocAdded)} / -${formatNumber(
        data.averageLocDeleted
      )}`
    : "n/a";

const tableRows = developers
  .map((developer) => {
    const data = metricsByDeveloper[developer];
    const averageLoc = formatAverageLoc(data);
    return `| ${developer} | ${formatMinutes(
      data.cycleTimeMinutes
    )} | ${data.prThroughput} | ${formatMinutes(
      data.averageCodingTimeMinutes
    )} | ${formatMinutes(
      data.reviewWaitingTimeMinutes
    )} | ${formatMinutes(data.reviewTimeMinutes)} | ${
      data.totalComments
    } | ${formatSizeMix(
      data.sizeCategoryCounts
    )} | ${formatNumber(data.averageCommentsPerPr)} | ${
      data.requestedChangesCount
    } | ${formatMinutes(
      data.timeToAddressChangesMinutes
    )} | ${averageLoc} | ${formatNumber(
      data.averageFilesChanged
    )} | ${data.prsWithoutReview} | ${data.prsWithoutApproval} |`;
  })
  .join("\n");

const table = `## Extended PR Metrics by Developer
| ${headers.join(" | ")} |
| ${headers.map(() => "---").join(" | ")} |
${tableRows}
`;

const cycleChartData = developers
  .map((developer) => ({
    label: developer,
    value:
      metricsByDeveloper[developer].cycleTimeMinutes !== null
        ? Number(
            (
              metricsByDeveloper[developer].cycleTimeMinutes / 60
            ).toFixed(2)
          )
        : 0,
  }))
  .filter((item) => item.value > 0);

const throughputChartData = developers.map((developer) => ({
  label: developer,
  value: metricsByDeveloper[developer].prThroughput || 0,
}));

const charts = [
  createMermaidChart(
    "Average Cycle Time (hours)",
    "Hours",
    "CycleTime",
    cycleChartData
  ),
  createMermaidChart(
    "PR Throughput",
    "PRs",
    "Throughput",
    throughputChartData
  ),
].filter(Boolean);

const markdownOutput = [table, ...charts].join("\n");
writeFile(mdOutputPath, markdownOutput);
const csvLines = [
  headers.join(","),
  ...developers.map((developer) => {
    const data = metricsByDeveloper[developer];
    const rowValues = [
      developer,
      formatMinutes(data.cycleTimeMinutes),
      data.prThroughput,
      formatMinutes(data.averageCodingTimeMinutes),
      formatMinutes(data.reviewWaitingTimeMinutes),
      formatMinutes(data.reviewTimeMinutes),
      data.totalComments,
      formatSizeMix(data.sizeCategoryCounts),
      formatNumber(data.averageCommentsPerPr),
      data.requestedChangesCount,
      formatMinutes(data.timeToAddressChangesMinutes),
      formatAverageLoc(data),
      formatNumber(data.averageFilesChanged),
      data.prsWithoutReview,
      data.prsWithoutApproval,
    ];
    return rowValues
      .map((value) => {
        const serialized = `${value}`;
        return serialized.includes(",")
          ? `"${serialized.replace(/"/g, '""')}"`
          : serialized;
      })
      .join(",");
  }),
].join("\n");
writeFile(csvOutputPath, csvLines);
console.log(
  `Extended metrics saved to:\n- ${path.resolve(
    process.cwd(),
    jsonOutputPath
  )}\n- ${path.resolve(process.cwd(), mdOutputPath)}\n- ${path.resolve(
    process.cwd(),
    csvOutputPath
  )}`
);
