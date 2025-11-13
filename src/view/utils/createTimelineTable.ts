import { Collection } from "../../converters/types";
import {
  approvalToMergeHeader,
  assignmentTimeHeader,
  assignmentToReviewRequestHeader,
  firstUpdateAfterChangeRequestHeader,
  reviewRequestToChangeHeader,
  timeAwaitingRepeatedReviewHeader,
  timeInDraftHeader,
  timeToApproveHeader,
  timeToMergeHeader,
  timeToReviewHeader,
  timeToReviewRequestHeader,
  totalMergedPrsHeader,
  updateToApprovalHeader,
} from "./constants";
import { createTable } from "./common";
import { formatMinutesDuration } from "./formatMinutesDuration";
import { StatsType } from "./types";
import { getValueAsIs } from "../../common/utils";

export const createTimelineTable = (
  data: Record<string, Record<string, Collection>>,
  type: StatsType,
  users: string[],
  date: string
) => {
  const tableRows = users
    .filter((user) => data[user]?.[date]?.merged)
    .map((user) => {
      return [
        `**${user}**`,
        formatMinutesDuration(data[user]?.[date]?.[type]?.timeInDraft || 0),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.assignmentTime || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.assignmentToReviewRequest || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.timeToReviewRequest || 0
        ),
        formatMinutesDuration(data[user]?.[date]?.[type]?.timeToReview || 0),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.timeWaitingForRepeatedReview || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.firstUpdateAfterChangeRequestTime || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.reviewRequestToChangeRequest || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.updateToApproval || 0
        ),
        formatMinutesDuration(
          data[user]?.[date]?.[type]?.approvalToMerge || 0
        ),
        formatMinutesDuration(data[user]?.[date]?.[type]?.timeToApprove || 0),
        formatMinutesDuration(data[user]?.[date]?.[type]?.timeToMerge || 0),
        data[user]?.[date]?.merged?.toString() || "0",
      ];
    });

  const pullRequestTimeLine = createTable({
    title: `Pull requests timeline(${
      type === "percentile" ? parseInt(getValueAsIs("PERCENTILE")) : ""
    }${type === "percentile" ? "th " : ""}${type}) ${date}`,
    description:
      "**Time to assignment** - time from PR creation to the first assignment event. \n**Assignment → Review request** - time between first assignment and first review request. \n**Review request → Changes requested** - time from the first review request until the first changes-requested review. \n**Time to first update after change request** - time between the first changes requested review and the first subsequent commit. \n**Update → Approval** - time from that follow-up commit until approval. \n**Approval → Merge** - time between approval and merge. Remaining columns show the traditional creation → review/approval/merge durations.",
    table: {
      headers: [
        "user",
        timeInDraftHeader,
        assignmentTimeHeader,
        assignmentToReviewRequestHeader,
        timeToReviewRequestHeader,
        timeToReviewHeader,
        timeAwaitingRepeatedReviewHeader,
        firstUpdateAfterChangeRequestHeader,
        reviewRequestToChangeHeader,
        updateToApprovalHeader,
        approvalToMergeHeader,
        timeToApproveHeader,
        timeToMergeHeader,
        totalMergedPrsHeader,
      ].filter((header, index) => tableRows.some((row) => row[index])),
      rows: tableRows.map((row) =>
        row.filter((cell, index) => tableRows.some((row) => row[index]))
      ),
    },
  });

  return pullRequestTimeLine;
};
