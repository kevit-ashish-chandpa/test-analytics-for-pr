import { getMultipleValuesInput, getValueAsIs } from "../../common/utils";
import { makeComplexRequest } from "../../requests";
import { invalidUserLogin, commentedTimelineEvent } from "../constants";
import { Collection } from "../types";
import {
  calcDraftTime,
  calcReviewCycles,
  checkUserInclusive,
  getApproveTime,
  getPullRequestSize,
  getPullRequestSizeCategory,
  isAbandonedPullRequest,
  isStalePullRequest,
} from "./calculations";
import { calcDifferenceInMinutes } from "./calculations/calcDifferenceInMinutes";
import { calcPRsize } from "./calculations/calcPRsize";
import { checkRevert } from "./checkRevert";
import { isBefore, parseISO } from "date-fns";

export const preparePullRequestTimeline = (
  pullRequestInfo: Awaited<
    ReturnType<typeof makeComplexRequest>
  >["pullRequestInfo"][number],
  pullRequestReviews: any[] = [],
  reviewRequest: any | undefined,
  statuses: any[] | undefined = [],
  collection: Collection,
  timelineEvents: any[] = [],
  pullRequestCommits: Awaited<
    ReturnType<typeof makeComplexRequest>
  >["commits"][number] = []
) => {
  if (!checkUserInclusive(pullRequestInfo?.user?.login || invalidUserLogin)) {
    return collection;
  }
  const commitHistory = Array.isArray(pullRequestCommits)
    ? pullRequestCommits
    : [];
  const firstReview = pullRequestReviews?.find(
    (review) =>
      review.user?.login !== pullRequestInfo?.user?.login &&
      checkUserInclusive(review.user?.login || invalidUserLogin)
  );
  const approveTime = getApproveTime(
    pullRequestReviews,
    parseInt(getValueAsIs("REQUIRED_APPROVALS"))
  );
  const reviewRequestTimestamp = reviewRequest?.created_at || null;
  const assignmentEvent = timelineEvents.find(
    (event) => event.event === "assigned"
  );
  const assignmentTimestamp = assignmentEvent?.created_at || null;

  const timeToReviewRequest = calcDifferenceInMinutes(
    pullRequestInfo?.created_at,
    reviewRequest?.created_at,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );

  const reviewerComments = timelineEvents?.filter(
    (event) => event.event === commentedTimelineEvent
  );
  const firstReviewerComment = reviewerComments?.find((comment) => {
    const commenterLogin = comment.actor?.login || invalidUserLogin;
    return (
      commenterLogin !== (pullRequestInfo?.user?.login || invalidUserLogin) &&
      checkUserInclusive(commenterLogin)
    );
  });
  const getEarlierIsoDate = (
    firstDate?: string | null,
    secondDate?: string | null
  ) => {
    if (!firstDate) {
      return secondDate || null;
    }
    if (!secondDate) {
      return firstDate;
    }
    return isBefore(parseISO(firstDate), parseISO(secondDate))
      ? firstDate
      : secondDate;
  };
  const firstReviewerEngagement = getEarlierIsoDate(
    firstReview?.submitted_at,
    firstReviewerComment?.created_at
  );

  const getNextEventAfter = (
    startDate?: string | null,
    candidates: Array<string | null | undefined> = []
  ) => {
    const startTime = startDate ? parseISO(startDate).getTime() : null;
    return (
      candidates
        .filter((value): value is string => Boolean(value))
        .map((value) => ({
          timestamp: parseISO(value).getTime(),
          value,
        }))
        .filter(
          (candidate) =>
            startTime === null || candidate.timestamp >= startTime
        )
        .sort((a, b) => a.timestamp - b.timestamp)[0]?.value || null
    );
  };

  const timeInDraft = calcDraftTime(
    pullRequestInfo?.created_at,
    pullRequestInfo?.closed_at,
    statuses
  ).reduce(
    (acc, period) =>
      acc +
      (calcDifferenceInMinutes(
        period[0],
        period[1],
        {
          endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
          startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
        },
        getMultipleValuesInput("HOLIDAYS")
      ) || 0),
    0
  );

  const timeToReview = calcDifferenceInMinutes(
    pullRequestInfo?.created_at,
    firstReviewerEngagement,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );

  const timeToApprove = calcDifferenceInMinutes(
    pullRequestInfo?.created_at,
    approveTime,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );

  const timeToMerge = calcDifferenceInMinutes(
    pullRequestInfo?.created_at,
    pullRequestInfo?.merged_at,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );

  const pullRequestSize = getPullRequestSize(
    pullRequestInfo?.additions,
    pullRequestInfo?.deletions
  );
  const pullRequestSizeCategory = getPullRequestSizeCategory(
    pullRequestInfo?.additions,
    pullRequestInfo?.deletions,
    pullRequestInfo?.changed_files
  );
  const {
    cycleCount,
    firstChangeRequestTime,
    firstUpdateAfterChangeRequest,
    firstCommitTime,
  } = calcReviewCycles(pullRequestReviews, timelineEvents, commitHistory);
  const firstUpdateAfterChangeRequestTime = calcDifferenceInMinutes(
    firstChangeRequestTime,
    firstUpdateAfterChangeRequest,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const reviewCompletionTimestamp = firstReviewerEngagement
    ? getNextEventAfter(firstReviewerEngagement, [
        firstChangeRequestTime,
        approveTime,
        pullRequestInfo?.merged_at || null,
      ])
    : null;
  const reviewTime = calcDifferenceInMinutes(
    firstReviewerEngagement,
    reviewCompletionTimestamp,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const changeResolutionTimestamp = getNextEventAfter(firstChangeRequestTime, [
    approveTime,
    pullRequestInfo?.merged_at || null,
  ]);
  const timeToAddressChanges = calcDifferenceInMinutes(
    firstChangeRequestTime,
    changeResolutionTimestamp,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const assignmentTime = calcDifferenceInMinutes(
    pullRequestInfo?.created_at,
    assignmentTimestamp,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const assignmentToReviewRequest = calcDifferenceInMinutes(
    assignmentTimestamp,
    reviewRequestTimestamp,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const reviewRequestToChangeRequest = calcDifferenceInMinutes(
    reviewRequestTimestamp,
    firstChangeRequestTime,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const updateToApproval = calcDifferenceInMinutes(
    firstUpdateAfterChangeRequest,
    approveTime,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const approvalToMerge = calcDifferenceInMinutes(
    approveTime,
    pullRequestInfo?.merged_at,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const codingTime = calcDifferenceInMinutes(
    firstCommitTime,
    pullRequestInfo?.created_at,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const cycleTimeFromFirstCommit = calcDifferenceInMinutes(
    firstCommitTime,
    pullRequestInfo?.merged_at,
    {
      endOfWorkingTime: getValueAsIs("CORE_HOURS_END"),
      startOfWorkingTime: getValueAsIs("CORE_HOURS_START"),
    },
    getMultipleValuesInput("HOLIDAYS")
  );
  const staleThreshold = parseInt(getValueAsIs("STALE_PR_DAYS_THRESHOLD")) || 14;
  const isStale = isStalePullRequest(pullRequestInfo, staleThreshold);
  const isAbandoned = isAbandonedPullRequest(pullRequestInfo);
  const reverted = checkRevert(
    pullRequestInfo?.head?.ref,
    pullRequestInfo?.labels
  );
  const reviewComments = pullRequestInfo?.review_comments || 0;
  const issueComments = pullRequestInfo?.comments || 0;
  const additions = pullRequestInfo?.additions || 0;
  const deletions = pullRequestInfo?.deletions || 0;
  const totalLinesChanged = additions + deletions;
  const commentsRatio =
    totalLinesChanged > 0
      ? (reviewComments + issueComments) / totalLinesChanged
      : reviewComments + issueComments || 0;
  const completedWithoutReview =
    Boolean(pullRequestInfo?.closed_at || pullRequestInfo?.merged_at) &&
    typeof timeToReview !== "number";
  const mergedWithoutApproval =
    Boolean(pullRequestInfo?.merged_at) && !approveTime;

  return {
    ...collection,
    timeToReview:
      typeof timeToReview === "number"
        ? [...(collection?.timeToReview || []), timeToReview]
        : collection.timeToReview,
    timeToApprove:
      typeof timeToApprove === "number"
        ? [...(collection?.timeToApprove || []), timeToApprove]
        : collection.timeToApprove,
    timeToMerge:
      typeof timeToMerge === "number"
        ? [...(collection?.timeToMerge || []), timeToMerge]
        : collection.timeToMerge,
    reviewTimes:
      typeof reviewTime === "number"
        ? [...(collection?.reviewTimes || []), reviewTime]
        : collection?.reviewTimes,
    timeToAddressChangeTimes:
      typeof timeToAddressChanges === "number"
        ? [
            ...(collection?.timeToAddressChangeTimes || []),
            timeToAddressChanges,
          ]
        : collection?.timeToAddressChangeTimes,
    timeToReviewRequest:
      typeof timeToReviewRequest === "number"
        ? [...(collection?.timeToReviewRequest || []), timeToReviewRequest]
        : collection.timeToReviewRequest,
    timeInDraft:
      typeof timeInDraft === "number"
        ? [...(collection?.timeInDraft || []), timeInDraft]
        : collection.timeInDraft,
    unreviewed:
      timeToReview !== null
        ? collection?.unreviewed || 0
        : (collection?.unreviewed || 0) + 1,
    unapproved:
      timeToApprove !== null
        ? collection?.unapproved || 0
        : (collection?.unapproved || 0) + 1,
    mergedWithoutApproval: mergedWithoutApproval
      ? (collection?.mergedWithoutApproval || 0) + 1
      : collection?.mergedWithoutApproval || 0,
    completedWithoutReview: completedWithoutReview
      ? (collection?.completedWithoutReview || 0) + 1
      : collection?.completedWithoutReview || 0,
    sizes: {
      ...(collection.sizes || {}),
      [pullRequestSize]: {
        ...(collection.sizes?.[pullRequestSize] || {}),
        timeToReview: timeToReview
          ? [
              ...(collection?.sizes?.[pullRequestSize]?.timeToReview || []),
              timeToReview,
            ]
          : collection?.sizes?.[pullRequestSize]?.timeToReview,
        timeToApprove: timeToApprove
          ? [
              ...(collection?.sizes?.[pullRequestSize]?.timeToApprove || []),
              timeToApprove,
            ]
          : collection?.sizes?.[pullRequestSize]?.timeToApprove,
        timeToMerge: timeToMerge
          ? [
              ...(collection?.sizes?.[pullRequestSize]?.timeToMerge || []),
              timeToMerge,
            ]
          : collection?.sizes?.[pullRequestSize]?.timeToMerge,
      },
    },
    pullRequestsInfo: [
      ...(collection?.pullRequestsInfo || []),
      {
        number: pullRequestInfo?.number,
        link: pullRequestInfo?._links?.html?.href,
        title: pullRequestInfo?.title,
        comments: pullRequestInfo?.review_comments,
        sizePoints: calcPRsize(
          pullRequestInfo?.additions,
          pullRequestInfo?.deletions
        ),
        additions: pullRequestInfo?.additions || 0,
        author: pullRequestInfo?.user?.login || invalidUserLogin,
        deletions: pullRequestInfo?.deletions || 0,
        timeToReview: timeToReview || 0,
        timeToApprove: timeToApprove ? timeToApprove - (timeToReview || 0) : 0,
        timeToMerge: timeToMerge ? timeToMerge - (timeToApprove || 0) : 0,
        reviewTimeFromFirstReview:
          typeof reviewTime === "number" ? reviewTime : 0,
        timeToAddressChanges:
          typeof timeToAddressChanges === "number"
            ? timeToAddressChanges
            : 0,
        commitCount: pullRequestInfo?.commits || 0,
        filesChanged: pullRequestInfo?.changed_files || 0,
        commentsPerLineChangeRatio: Number.isFinite(commentsRatio)
          ? commentsRatio
          : 0,
        reviewCycleCount: cycleCount,
        stalePrFlag: isStale,
        abandonedPrFlag: isAbandoned,
        revertedPrFlag: reverted,
        assignmentTimestamp,
        reviewRequestTimestamp,
        firstUpdateAfterChangeRequestTimestamp:
          firstUpdateAfterChangeRequest || null,
        approvalTimestamp: approveTime,
        mergeTimestamp: pullRequestInfo?.merged_at || null,
        assignmentTime: typeof assignmentTime === "number" ? assignmentTime : 0,
        firstUpdateAfterChangeRequestTime:
          typeof firstUpdateAfterChangeRequestTime === "number"
            ? firstUpdateAfterChangeRequestTime
            : 0,
        assignmentToReviewRequest:
          typeof assignmentToReviewRequest === "number"
            ? assignmentToReviewRequest
            : 0,
        reviewRequestToChangeRequest:
          typeof reviewRequestToChangeRequest === "number"
            ? reviewRequestToChangeRequest
            : 0,
        updateToApproval:
          typeof updateToApproval === "number" ? updateToApproval : 0,
        approvalToMerge:
          typeof approvalToMerge === "number" ? approvalToMerge : 0,
        firstCommitTimestamp: firstCommitTime || null,
        codingTime: typeof codingTime === "number" ? codingTime : 0,
        cycleTimeFromFirstCommit:
          typeof cycleTimeFromFirstCommit === "number"
            ? cycleTimeFromFirstCommit
            : 0,
        sizeCategory: pullRequestSizeCategory,
      },
    ],
    reviewCycleCounts:
      typeof cycleCount === "number"
        ? [...(collection?.reviewCycleCounts || []), cycleCount]
        : collection?.reviewCycleCounts,
    firstUpdateAfterRequestTimes:
      typeof firstUpdateAfterChangeRequestTime === "number"
        ? [
            ...(collection?.firstUpdateAfterRequestTimes || []),
            firstUpdateAfterChangeRequestTime,
          ]
        : collection?.firstUpdateAfterRequestTimes,
    assignmentTimes:
      typeof assignmentTime === "number"
        ? [...(collection?.assignmentTimes || []), assignmentTime]
        : collection?.assignmentTimes,
    assignmentTimestamps: assignmentTimestamp
      ? [...(collection?.assignmentTimestamps || []), assignmentTimestamp]
      : collection?.assignmentTimestamps,
    reviewRequestTimestamps: reviewRequestTimestamp
      ? [...(collection?.reviewRequestTimestamps || []), reviewRequestTimestamp]
      : collection?.reviewRequestTimestamps,
    firstUpdateAfterRequestTimestamps: firstUpdateAfterChangeRequest
      ? [
          ...(collection?.firstUpdateAfterRequestTimestamps || []),
          firstUpdateAfterChangeRequest,
        ]
      : collection?.firstUpdateAfterRequestTimestamps,
    approvalTimestamps: approveTime
      ? [...(collection?.approvalTimestamps || []), approveTime]
      : collection?.approvalTimestamps,
    mergeTimestamps: pullRequestInfo?.merged_at
      ? [...(collection?.mergeTimestamps || []), pullRequestInfo?.merged_at]
      : collection?.mergeTimestamps,
    assignmentToReviewRequestTimes:
      typeof assignmentToReviewRequest === "number"
        ? [
            ...(collection?.assignmentToReviewRequestTimes || []),
            assignmentToReviewRequest,
          ]
        : collection?.assignmentToReviewRequestTimes,
    reviewRequestToChangeRequestTimes:
      typeof reviewRequestToChangeRequest === "number"
        ? [
            ...(collection?.reviewRequestToChangeRequestTimes || []),
            reviewRequestToChangeRequest,
          ]
        : collection?.reviewRequestToChangeRequestTimes,
    updateToApprovalTimes:
      typeof updateToApproval === "number"
        ? [...(collection?.updateToApprovalTimes || []), updateToApproval]
        : collection?.updateToApprovalTimes,
    approvalToMergeTimes:
      typeof approvalToMerge === "number"
        ? [...(collection?.approvalToMergeTimes || []), approvalToMerge]
        : collection?.approvalToMergeTimes,
    codingTimes:
      typeof codingTime === "number"
        ? [...(collection?.codingTimes || []), codingTime]
        : collection?.codingTimes,
    cycleTimesFromFirstCommit:
      typeof cycleTimeFromFirstCommit === "number"
        ? [
            ...(collection?.cycleTimesFromFirstCommit || []),
            cycleTimeFromFirstCommit,
          ]
        : collection?.cycleTimesFromFirstCommit,
  };
};
