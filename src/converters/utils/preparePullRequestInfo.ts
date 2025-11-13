import { makeComplexRequest } from "../../requests";
import { Collection } from "../types";
import {
  getPullRequestSize,
  isAbandonedPullRequest,
  isStalePullRequest,
} from "./calculations";
import { checkRevert } from "./checkRevert";
import { getValueAsIs } from "../../common/utils";

export const preparePullRequestInfo = (
  pullRequest: Awaited<
    ReturnType<typeof makeComplexRequest>
  >["pullRequestInfo"][number],
  collection?: Collection
) => {
  const previousComments =
    typeof collection?.comments === "number" ? collection?.comments : 0;
  const comments = previousComments + (pullRequest?.comments || 0);

  const previousReviewComments =
    typeof collection?.totalReviewComments === "number"
      ? collection?.totalReviewComments
      : 0;

  const currentReviewComments = pullRequest?.review_comments || 0;
  const totalReviewComments = previousReviewComments + currentReviewComments;
  const commitCount = pullRequest?.commits || 0;
  const changedFiles = pullRequest?.changed_files || 0;
  const additionsValue = pullRequest?.additions || 0;
  const deletionsValue = pullRequest?.deletions || 0;
  const linesChanged = additionsValue + deletionsValue;
  const commentVolume =
    currentReviewComments + (pullRequest?.comments || 0);
  const commentsRatio =
    linesChanged > 0 ? commentVolume / linesChanged : commentVolume || 0;
  const staleThreshold = parseInt(getValueAsIs("STALE_PR_DAYS_THRESHOLD")) || 14;
  const isStale = isStalePullRequest(pullRequest, staleThreshold);
  const isAbandoned = isAbandonedPullRequest(pullRequest);
  const isReverted = checkRevert(pullRequest?.head?.ref, pullRequest?.labels);

  return {
    ...collection,
    opened: (collection?.opened || 0) + 1,
    closed: pullRequest?.closed_at
      ? (collection?.closed || 0) + 1
      : collection?.closed || 0,
    merged: pullRequest?.merged
      ? (collection?.merged || 0) + 1
      : collection?.merged || 0,
    comments,
    totalReviewComments,
    reverted: (collection?.reverted || 0) + (isReverted ? 1 : 0),
    additions: (collection?.additions || 0) + additionsValue,
    deletions: (collection?.deletions || 0) + deletionsValue,
    prSizes: [
      ...(collection?.prSizes || []),
      getPullRequestSize(pullRequest?.additions, pullRequest?.deletions),
    ],
    commitCounts: [...(collection?.commitCounts || []), commitCount],
    changedFilesCounts: [
      ...(collection?.changedFilesCounts || []),
      changedFiles,
    ],
    linesAddedList: [...(collection?.linesAddedList || []), additionsValue],
    linesRemovedList: [...(collection?.linesRemovedList || []), deletionsValue],
    commentsPerLineChangeRatio: [
      ...(collection?.commentsPerLineChangeRatio || []),
      Number.isFinite(commentsRatio) ? commentsRatio : 0,
    ],
    stalePullRequests:
      (collection?.stalePullRequests || 0) + (isStale ? 1 : 0),
    abandonedPullRequests:
      (collection?.abandonedPullRequests || 0) + (isAbandoned ? 1 : 0),
  };
};
