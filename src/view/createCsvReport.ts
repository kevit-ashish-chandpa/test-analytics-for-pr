import { Collection } from "../converters/types";
import { getMultipleValuesInput, getValueAsIs } from "../common/utils";
import { StatsType } from "./utils/types";

type CsvRow = [string, string, string, string, string, string];

const statsTypeOrder: StatsType[] = ["percentile", "median", "average"];
const sizeOrder = ["xs", "s", "m", "l", "xl"] as const;

const isStatsType = (value: string): value is StatsType =>
  (statsTypeOrder as readonly string[]).includes(value);

const csvEscape = (value: string) => {
  if (value === "") {
    return "";
  }
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const normalizeNumberInput = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
};

const formatValue = (value: number | string) => {
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "";
    }
    return value.toString();
  }
  return value;
};

export const createCsvReport = (
  data: Record<string, Record<string, Collection>>,
  users: string[],
  dates: string[]
) => {
  const requestedSectionsRaw = getMultipleValuesInput("SHOW_STATS_TYPES");
  const includeAllSections = requestedSectionsRaw.length === 0;
  const requestedSections = new Set(requestedSectionsRaw);
  const aggregateMethodsRaw = getMultipleValuesInput("AGGREGATE_VALUE_METHODS");
  const filteredMethods = aggregateMethodsRaw
    .filter((method) => isStatsType(method))
    .map((method) => method as StatsType);
  const aggregateMethods =
    filteredMethods.length > 0 ? filteredMethods : statsTypeOrder;
  const topListAmount = normalizeNumberInput(
    getValueAsIs("TOP_LIST_AMOUNT"),
    5
  );
  const rows: CsvRow[] = [
    ["section", "date", "subject", "metric", "value", "details"],
  ];

  const includeSection = (section: string) =>
    includeAllSections || requestedSections.has(section);

  const addRow = (
    section: string,
    date: string,
    subject: string,
    metric: string,
    value: number | string | undefined | null,
    details = ""
  ) => {
    if (value === undefined || value === null) return;
    rows.push([
      section,
      date,
      subject,
      metric,
      formatValue(value),
      details,
    ]);
  };

  const addTimelineStats = (section: string) => {
    if (!includeSection(section)) return;
    dates.forEach((date) => {
      users.forEach((user) => {
        const collection = data[user]?.[date];
        if (!collection) return;

        aggregateMethods.forEach((method) => {
          const stats = collection[method];
          if (!stats) return;
          addRow(section, date, user, `${method}_time_in_draft`, stats.timeInDraft);
          addRow(
            section,
            date,
            user,
            `${method}_time_to_review_request`,
            stats.timeToReviewRequest
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_to_review`,
            stats.timeToReview
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_to_approve`,
            stats.timeToApprove
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_to_merge`,
            stats.timeToMerge
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_from_open_to_response`,
            stats.timeFromOpenToResponse
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_from_initial_request_to_response`,
            stats.timeFromInitialRequestToResponse
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_from_repeated_request_to_response`,
            stats.timeFromRepeatedRequestToResponse
          );
          addRow(
            section,
            date,
            user,
            `${method}_time_waiting_for_repeated_review`,
            stats.timeWaitingForRepeatedReview
          );
        });

        Object.entries(collection.reviewTimeIntervals || {}).forEach(
          ([interval, count]) => {
            addRow(
              `${section}_distribution`,
              date,
              user,
              `review_interval_${interval}_hours`,
              count
            );
          }
        );
        Object.entries(collection.approvalTimeIntervals || {}).forEach(
          ([interval, count]) => {
            addRow(
              `${section}_distribution`,
              date,
              user,
              `approval_interval_${interval}_hours`,
              count
            );
          }
        );
        Object.entries(collection.mergeTimeIntervals || {}).forEach(
          ([interval, count]) => {
            addRow(
              `${section}_distribution`,
              date,
              user,
              `merge_interval_${interval}_hours`,
              count
            );
          }
        );

        Object.entries(collection.sizes || {}).forEach(([size, stats]) => {
          aggregateMethods.forEach((method) => {
            const timedStats = (stats as Record<string, any>)[method];
            if (!timedStats) return;
            addRow(
              `${section}_by_size`,
              date,
              `${user}:${size}`,
              `${method}_time_to_review`,
              timedStats.timeToReview
            );
            addRow(
              `${section}_by_size`,
              date,
              `${user}:${size}`,
              `${method}_time_to_approve`,
              timedStats.timeToApprove
            );
            addRow(
              `${section}_by_size`,
              date,
              `${user}:${size}`,
              `${method}_time_to_merge`,
              timedStats.timeToMerge
            );
          });
        });
      });

      const pullRequests =
        data.total?.[date]?.pullRequestsInfo?.slice() || [];
      if (pullRequests.length) {
        (["timeToReview", "timeToApprove", "timeToMerge"] as const).forEach(
          (metric) => {
            pullRequests
              .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
              .slice(0, topListAmount)
              .forEach((pullRequest, index) => {
                const subject =
                  pullRequest.title || `PR #${pullRequest.number}`;
                addRow(
                  `${section}_notable_prs`,
                  date,
                  subject,
                  `${metric}_rank`,
                  index + 1,
                  pullRequest.link || ""
                );
                addRow(
                  `${section}_notable_prs`,
                  date,
                  subject,
                  `${metric}_minutes`,
                  pullRequest[metric] || 0
                );
                addRow(
                  `${section}_notable_prs`,
                  date,
                  subject,
                  "author",
                  pullRequest.author || ""
                );
              });
          }
        );
      }
    });
  };

  const addWorkloadStats = () => {
    if (!includeSection("workload")) return;
    dates.forEach((date) => {
      users.forEach((user) => {
        const collection = data[user]?.[date];
        if (!collection) return;
        addRow("workload", date, user, "total_opened_prs", collection.opened);
        addRow("workload", date, user, "total_merged_prs", collection.merged);
        addRow("workload", date, user, "total_reverted_prs", collection.reverted);
        addRow("workload", date, user, "prs_without_review", collection.unreviewed);
        addRow(
          "workload",
          date,
          user,
          "prs_without_approval",
          collection.unapproved
        );
        addRow("workload", date, user, "additions", collection.additions);
        addRow("workload", date, user, "deletions", collection.deletions);

        sizeOrder.forEach((size) => {
          const count =
            collection.prSizes?.filter((prSize) => prSize === size).length || 0;
          addRow("workload", date, user, `pr_size_${size}`, count);
        });
      });

      const largest =
        data.total?.[date]?.pullRequestsInfo
          ?.slice()
          ?.sort(
            (a, b) => (b.sizePoints || 0) - (a.sizePoints || 0)
          )
          ?.slice(0, topListAmount) || [];

      largest.forEach((pullRequest, index) => {
        const subject = pullRequest.title || `PR #${pullRequest.number}`;
        addRow(
          "workload_notable_prs",
          date,
          subject,
          "rank",
          index + 1,
          pullRequest.link || ""
        );
        addRow(
          "workload_notable_prs",
          date,
          subject,
          "size_points",
          pullRequest.sizePoints || 0
        );
        addRow(
          "workload_notable_prs",
          date,
          subject,
          "additions",
          pullRequest.additions || 0
        );
        addRow(
          "workload_notable_prs",
          date,
          subject,
          "deletions",
          pullRequest.deletions || 0
        );
        addRow(
          "workload_notable_prs",
          date,
          subject,
          "author",
          pullRequest.author || ""
        );
      });
    });
  };

  const addReviewEngagementStats = () => {
    if (!includeSection("code-review-engagement")) return;
    dates.forEach((date) => {
      users.forEach((user) => {
        const collection = data[user]?.[date];
        if (!collection) return;
        const reviewsTotal =
          collection.reviewsConducted?.total?.total ?? undefined;
        addRow(
          "code-review-engagement",
          date,
          user,
          "reviews_conducted_total",
          reviewsTotal
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "reviews_changes_requested",
          collection.reviewsConducted?.total?.changes_requested
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "reviews_commented",
          collection.reviewsConducted?.total?.commented
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "reviews_approved",
          collection.reviewsConducted?.total?.approved
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "discussions_conducted_agreed",
          collection.discussions?.conducted?.agreed
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "discussions_conducted_disagreed",
          collection.discussions?.conducted?.disagreed
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "discussions_conducted_total",
          collection.discussions?.conducted?.total
        );
        addRow(
          "code-review-engagement",
          date,
          user,
          "comments_conducted",
          collection.commentsConducted
        );
        sizeOrder.forEach((size) => {
          const count =
            collection.reviewsConductedSize?.filter(
              (prSize) => prSize === size
            ).length || 0;
          addRow(
            "code-review-engagement",
            date,
            user,
            `reviewed_size_${size}`,
            count
          );
        });
      });
    });
  };

  const addQualityStats = () => {
    if (!includeSection("pr-quality")) return;
    dates.forEach((date) => {
      users.forEach((user) => {
        const collection = data[user]?.[date];
        if (!collection) return;
        addRow("pr-quality", date, user, "merged_prs", collection.merged);
        const changesRequested =
          data.total?.[date]?.reviewsConducted?.[user]?.changes_requested;
        addRow(
          "pr-quality",
          date,
          user,
          "changes_requested_received",
          changesRequested
        );
        addRow(
          "pr-quality",
          date,
          user,
          "discussions_received_agreed",
          collection.discussions?.received?.agreed
        );
        addRow(
          "pr-quality",
          date,
          user,
          "discussions_received_disagreed",
          collection.discussions?.received?.disagreed
        );
        addRow(
          "pr-quality",
          date,
          user,
          "discussions_received_total",
          collection.discussions?.received?.total
        );
        addRow(
          "pr-quality",
          date,
          user,
          "review_comments_received",
          collection.reviewComments
        );
      });

      const commented =
        data.total?.[date]?.pullRequestsInfo
          ?.slice()
          ?.sort((a, b) => (b.comments || 0) - (a.comments || 0))
          ?.slice(0, topListAmount) || [];

      commented.forEach((pullRequest, index) => {
        const subject = pullRequest.title || `PR #${pullRequest.number}`;
        addRow(
          "pr-quality_notable_prs",
          date,
          subject,
          "comments_rank",
          index + 1,
          pullRequest.link || ""
        );
        addRow(
          "pr-quality_notable_prs",
          date,
          subject,
          "comments",
          pullRequest.comments || 0
        );
        addRow(
          "pr-quality_notable_prs",
          date,
          subject,
          "author",
          pullRequest.author || ""
        );
      });
    });
  };

  const addResponseStats = () => {
    if (!includeSection("response-time")) return;
    dates.forEach((date) => {
      users.forEach((user) => {
        const collection = data[user]?.[date];
        if (!collection) return;
        addRow(
          "response-time",
          date,
          user,
          "review_requests_conducted",
          collection.reviewRequestsConducted
        );
        addRow(
          "response-time",
          date,
          user,
          "reviews_conducted_total",
          collection.reviewsConducted?.total?.total
        );

        aggregateMethods.forEach((method) => {
          const stats = collection[method];
          if (!stats) return;
          addRow(
            "response-time",
            date,
            user,
            `${method}_time_from_open_to_response`,
            stats.timeFromOpenToResponse
          );
          addRow(
            "response-time",
            date,
            user,
            `${method}_time_from_initial_request_to_response`,
            stats.timeFromInitialRequestToResponse
          );
          addRow(
            "response-time",
            date,
            user,
            `${method}_time_from_repeated_request_to_response`,
            stats.timeFromRepeatedRequestToResponse
          );
        });
      });
    });
  };

  const addActivityTimeStats = () => {
    const includeActivity =
      getValueAsIs("SHOW_ACTIVITY_TIME_GRAPHS") === "true" ||
      data.total?.total?.actionsTime;
    if (!includeActivity) return;
    users.forEach((user) => {
      const actions = data[user]?.total?.actionsTime;
      if (!actions) return;
      Object.entries(actions).forEach(([hour, values]) => {
        Object.entries(values || {}).forEach(([action, count]) => {
          addRow(
            "activity-time",
            "total",
            user,
            `${action}_hour_${hour}`,
            count
          );
        });
      });
    });
  };

  addTimelineStats("timeline");
  addWorkloadStats();
  addReviewEngagementStats();
  addQualityStats();
  addResponseStats();
  addActivityTimeStats();

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
};
