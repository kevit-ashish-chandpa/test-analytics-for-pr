#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [, , inputPath, csvOutputPath, mdOutputPath] = process.argv;

if (!inputPath || !csvOutputPath || !mdOutputPath) {
  console.error(
    "Usage: node scripts/generate-pr-metrics.js <collection.json> <output.csv> <output.md>"
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

const average = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + (Number(value) || 0), 0);
  return sum / values.length;
};

const formatMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) return "n/a";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = Math.abs(rounded % 60);
  if (hours === 0) {
    return `${mins}m`;
  }
  return `${hours}h ${mins}m`;
};

const formatNumber = (value, fractionDigits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(fractionDigits);
};

const getAverageFromPrInfo = (pullRequestsInfo = [], key) => {
  if (!Array.isArray(pullRequestsInfo) || pullRequestsInfo.length === 0)
    return null;
  const values = pullRequestsInfo
    .map((info) => info[key])
    .filter((value) => typeof value === "number" && value > 0);
  return average(values);
};

const metricsDefinitions = [
  {
    key: "cycle_time",
    title: "Cycle Time (first commit → merge)",
    measure: "Total time from first commit on branch to merge",
    why: "Core flow metric, tells you how long work takes end-to-end",
    compute: (userData) =>
      formatMinutes(average(userData.cycleTimesFromFirstCommit)),
  },
  {
    key: "pr_throughput",
    title: "PR Throughput",
    measure: "Number of merged PRs per period",
    why: "Shows delivery volume and trend",
    compute: (userData) => `${userData.merged || 0}`,
  },
  {
    key: "coding_time",
    title: "Average Coding Time (first commit → PR opened)",
    measure: "Time before dev raises a PR (coding time)",
    why: "Shows if PRs are too large or feedback is delayed",
    compute: (userData) => formatMinutes(average(userData.codingTimes)),
  },
  {
    key: "review_waiting_time",
    title: "Review Waiting Time (PR opened → first review)",
    measure: "How long PRs wait before someone starts reviewing",
    why: "Major bottleneck finder",
    compute: (userData) => formatMinutes(average(userData.timeToReview)),
  },
  {
    key: "review_time",
    title: "Review Time (first review → approval/merge)",
    measure: "Actual time reviewers spend",
    why: "Helps diagnose review load/complexity",
    compute: (userData) =>
      formatMinutes(getAverageFromPrInfo(userData.pullRequestsInfo, "timeToApprove")),
  },
  {
    key: "total_comments",
    title: "Total Comments",
    measure: "All discussion comments on the PRs",
    why: "Extra context for heavy discussions",
    compute: (userData) => {
      const total =
        (userData.comments || 0) + (userData.reviewComments || 0);
      return `${total}`;
    },
  },
  {
    key: "pr_size_category",
    title: "PR Size Category",
    measure: "Small/medium/large PR based on LOC/files changed",
    why: "Large PRs cause slow reviews, bugs, pressure",
    compute: (userData) => {
      const sizes = ["xs", "s", "m", "l", "xl"];
      const counts = sizes
        .map((size) => {
          const total =
            userData.prSizes?.filter((entry) => entry === size)?.length || 0;
          return `${size}:${total}`;
        })
        .join(" / ");
      return counts || "n/a";
    },
  },
  {
    key: "avg_comments_per_pr",
    title: "Average Comments per PR",
    measure: "Count of PR comments",
    why: "Shows review effort and quality signals",
    compute: (userData) => {
      const total =
        (userData.comments || 0) + (userData.reviewComments || 0);
      const divisor = userData.opened || 0;
      if (!divisor) return "n/a";
      return formatNumber(total / divisor, 2);
    },
  },
  {
    key: "requested_changes",
    title: "Requested Changes Count",
    measure: "How often reviewers ask for changes",
    why: "Reflects code quality or reviewer strictness",
    compute: (userData, context) => {
      const total =
        context.globalReviews?.[context.user]?.changes_requested || 0;
      return `${total}`;
    },
  },
  {
    key: "time_to_address_changes",
    title: "Time to Address Changes (changes requested → approval/merge)",
    measure: "How long devs take to respond",
    why: "Shows responsiveness + clarity of work",
    compute: (userData) =>
      formatMinutes(average(userData.updateToApprovalTimes)),
  },
  {
    key: "avg_loc",
    title: "Average LOC Added/Deleted",
    measure: "Actual code churn per PR",
    why: "Helps spot overly large changes",
    compute: (userData) => {
      const count = userData.opened || 0;
      if (!count) return "n/a";
      const additions = (userData.additions || 0) / count;
      const deletions = (userData.deletions || 0) / count;
      return `+${formatNumber(additions)} / -${formatNumber(deletions)}`;
    },
  },
  {
    key: "avg_files",
    title: "Average Files Added/Deleted",
    measure: "Files involved in PR",
    why: "Good signal for complexity & scope",
    compute: (userData) => {
      const avgFiles = average(userData.changedFilesCounts);
      return avgFiles === null ? "n/a" : formatNumber(avgFiles);
    },
  },
  {
    key: "prs_without_review",
    title: "PRs Without Review",
    measure: "PRs merged/closed with no review events",
    why: "Process or quality failure",
    compute: (userData) => `${userData.unreviewed || 0}`,
  },
  {
    key: "prs_without_approval",
    title: "PRs Without Approval",
    measure: "PRs merged without an approval review",
    why: "Depends on team rules",
    compute: (userData) => `${userData.unapproved || 0}`,
  },
];

const writeCsv = (rows, outputPath) => {
  const headers = [
    "Developer",
    "Metric",
    "Value",
    "What it Measures",
    "Why it Matters",
  ];
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          const serialized =
            typeof value === "string" ? value : JSON.stringify(value);
          return serialized.includes(",")
            ? `"${serialized.replace(/"/g, '""')}"`
            : serialized;
        })
        .join(",")
    ),
  ].join("\n");
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), csv, "utf-8");
};

const writeMarkdown = (metricsByDeveloper, outputPath) => {
  const sections = Object.entries(metricsByDeveloper)
    .map(([developer, metrics]) => {
      const tableRows = metrics
        .map(
          (metric) =>
            `| ${metric.Metric} | ${metric.Value} | ${metric["Why it Matters"]} |`
        )
        .join("\n");
      return `### ${developer}
| Metric | Value | Why it Matters |
| --- | --- | --- |
${tableRows}
`;
    })
    .join("\n");
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), sections, "utf-8");
};

const collection = readJson(inputPath);
const totalCollection = collection.total?.total || {};
const globalReviews = totalCollection.reviewsConducted || {};

const developers = Object.keys(collection).filter(
  (key) => key !== "total" && collection[key]?.total
);

const csvRows = [];
const markdownData = {};

developers.forEach((developer) => {
  const userData = collection[developer].total || {};
  if (!userData.opened) return;
  const metrics = metricsDefinitions.map((definition) => ({
    Developer: developer,
    Metric: definition.title,
    Value: definition.compute(userData, { user: developer, globalReviews }),
    "What it Measures": definition.measure,
    "Why it Matters": definition.why,
  }));
  csvRows.push(...metrics);
  markdownData[developer] = metrics;
});

writeCsv(csvRows, csvOutputPath);
writeMarkdown(markdownData, mdOutputPath);
console.log(
  `PR metrics report generated:\n- ${path.resolve(
    process.cwd(),
    csvOutputPath
  )}\n- ${path.resolve(process.cwd(), mdOutputPath)}`
);
