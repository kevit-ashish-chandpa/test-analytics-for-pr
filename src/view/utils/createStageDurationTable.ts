import { Collection } from "../../converters/types";
import {
  approvalToMergeHeader,
  assignmentTimeHeader,
  assignmentToReviewRequestHeader,
  changeRequestToUpdateHeader,
  reviewRequestToChangeHeader,
  updateToApprovalHeader,
} from "./constants";
import { createTable } from "./common";
import { formatMinutesDuration } from "./formatMinutesDuration";
import { StatsType } from "./types";

export const createStageDurationTable = (
  data: Record<string, Record<string, Collection>>,
  type: StatsType,
  users: string[],
  date: string
) => {
  let hasData = false;
  const tableRows = users
    .filter((user) => data[user]?.[date]?.merged)
    .map((user) => {
      const assignment =
        data[user]?.[date]?.[type]?.assignmentTime || 0;
      const assignmentToReview =
        data[user]?.[date]?.[type]?.assignmentToReviewRequest || 0;
      const reviewToChange =
        data[user]?.[date]?.[type]?.reviewRequestToChangeRequest || 0;
      const changeToUpdate =
        data[user]?.[date]?.[type]?.firstUpdateAfterChangeRequestTime || 0;
      const updateToApprovalValue =
        data[user]?.[date]?.[type]?.updateToApproval || 0;
      const approvalToMergeValue =
        data[user]?.[date]?.[type]?.approvalToMerge || 0;
      const stageValues = [
        assignment,
        assignmentToReview,
        reviewToChange,
        changeToUpdate,
        updateToApprovalValue,
        approvalToMergeValue,
      ];
      if (stageValues.some((value) => value)) {
        hasData = true;
      }
      return [
        `**${user}**`,
        ...stageValues.map((value) => formatMinutesDuration(value || 0)),
      ];
    });

  if (!hasData) {
    return "";
  }

  return createTable({
    title: `Stage duration breakdown(${type}) ${date}`,
    description:
      "**Creation → Assignment** through **Approval → Merge** show the average time spent in each stage. These values complement the overall creation → milestone durations shown in the main timeline table.",
    table: {
      headers: [
        "user",
        assignmentTimeHeader,
        assignmentToReviewRequestHeader,
        reviewRequestToChangeHeader,
        changeRequestToUpdateHeader,
        updateToApprovalHeader,
        approvalToMergeHeader,
      ],
      rows: tableRows,
    },
  });
};
