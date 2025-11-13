import { differenceInCalendarDays, parseISO } from "date-fns";

type PullRequestInfo = {
  created_at?: string | null;
  closed_at?: string | null;
  merged?: boolean | null;
  state?: string | null;
};

export const isStalePullRequest = (
  pullRequest: PullRequestInfo | null | undefined,
  thresholdDays: number,
  now: Date = new Date()
) => {
  if (!pullRequest || !pullRequest.created_at) return false;
  if (pullRequest.state !== "open") return false;
  if (!Number.isFinite(thresholdDays) || thresholdDays <= 0) {
    return false;
  }
  const createdAt = parseISO(pullRequest.created_at);
  return differenceInCalendarDays(now, createdAt) >= thresholdDays;
};

export const isAbandonedPullRequest = (
  pullRequest: PullRequestInfo | null | undefined
) => {
  if (!pullRequest) return false;
  return pullRequest.state === "closed" && !pullRequest.merged;
};
