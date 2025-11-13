#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const [,, inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error("Usage: collection-to-csv <input-json> <output-csv>");
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
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + (Number(value) || 0), 0);
  return sum / values.length;
};

const toCsv = (rows, headers) => {
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "string") {
            const needsQuotes = value.includes(",") || value.includes('"');
            const sanitized = value.replace(/"/g, '""');
            return needsQuotes ? `"${sanitized}"` : sanitized;
          }
          if (typeof value === "number") return value.toString();
          return JSON.stringify(value);
        })
        .join(",")
    ),
  ].join("\n");
};

const data = readJson(inputPath);
const rows = [];

Object.entries(data || {}).forEach(([user, dates]) => {
  Object.entries(dates || {}).forEach(([dateKey, metrics]) => {
    if (!metrics) return;
    rows.push({
      user,
      date: dateKey,
      opened: metrics.opened || 0,
      merged: metrics.merged || 0,
      stale_prs: metrics.stalePullRequests || 0,
      abandoned_prs: metrics.abandonedPullRequests || 0,
      avg_commit_count: average(metrics.commitCounts),
      avg_files_changed: average(metrics.changedFilesCounts),
      lines_added: metrics.additions || 0,
      lines_removed: metrics.deletions || 0,
      review_cycle_total: (metrics.reviewCycleCounts || []).reduce(
        (acc, value) => acc + (Number(value) || 0),
        0
      ),
      reviewer_pending: metrics.reviewsPending || 0,
      comments_per_line_ratio: average(metrics.commentsPerLineChangeRatio),
      assignment_avg_minutes: average(metrics.assignmentTimes),
      assignment_to_review_request_avg: average(
        metrics.assignmentToReviewRequestTimes
      ),
      review_request_to_change_request_avg: average(
        metrics.reviewRequestToChangeRequestTimes
      ),
      change_request_to_update_avg: average(metrics.firstUpdateAfterRequestTimes),
      update_to_approval_avg: average(metrics.updateToApprovalTimes),
      approval_to_merge_avg: average(metrics.approvalToMergeTimes),
    });
  });
});

const headers = [
  "user",
  "date",
  "opened",
  "merged",
  "stale_prs",
  "abandoned_prs",
  "avg_commit_count",
  "avg_files_changed",
  "lines_added",
  "lines_removed",
  "review_cycle_total",
  "reviewer_pending",
  "comments_per_line_ratio",
  "assignment_avg_minutes",
  "assignment_to_review_request_avg",
  "review_request_to_change_request_avg",
  "change_request_to_update_avg",
  "update_to_approval_avg",
  "approval_to_merge_avg",
];

const csv = toCsv(rows, headers);
const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
fs.writeFileSync(absoluteOutputPath, csv, "utf-8");
console.log(`CSV written to ${absoluteOutputPath}`);
