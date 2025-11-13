import { Collection } from "../../converters/types";
import {
  additionsDeletionsHeader,
  commitsFilesChangedHeader,
  prSizesHeader,
  staleAbandonedHeader,
  totalMergedPrsHeader,
  totalOpenedPrsHeader,
  totalRevertedPrsHeader,
  unapprovedPrsHeader,
  unreviewedPrsHeader,
} from "./constants";
import { createList, createTable } from "./common";
import { getValueAsIs } from "../../common/utils";

export const createTotalTable = (
  data: Record<string, Record<string, Collection>>,
  users: string[],
  date: string
) => {
  const sizes = ["xs", "s", "m", "l", "xl"];
  const tableRowsTotal = users
    .filter((user) => data[user]?.[date]?.opened)
    .map((user) => {
      const commitCounts = data[user]?.[date]?.commitCounts || [];
      const changedFilesCounts = data[user]?.[date]?.changedFilesCounts || [];
      const commitsAvg =
        commitCounts.length > 0
          ? (commitCounts.reduce((acc, value) => acc + value, 0) /
              commitCounts.length
            ).toFixed(1)
          : "0";
      const changedFilesAvg =
        changedFilesCounts.length > 0
          ? (changedFilesCounts.reduce((acc, value) => acc + value, 0) /
              changedFilesCounts.length
            ).toFixed(1)
          : "0";
      const staleCount = data[user]?.[date]?.stalePullRequests || 0;
      const abandonedCount = data[user]?.[date]?.abandonedPullRequests || 0;
      return [
        `**${user}**`,
        data[user]?.[date]?.opened?.toString() || "0",
        data[user]?.[date]?.merged?.toString() || "0",
        data[user]?.[date]?.reverted?.toString() || "0",
        `${staleCount} / ${abandonedCount}`,
        data[user]?.[date]?.unreviewed?.toString() || "0",
        data[user]?.[date]?.unapproved?.toString() || "0",
        `+${data[user]?.[date].additions || 0}/-${
          data[user]?.[date].deletions || 0
        }`,
        `${commitsAvg} / ${changedFilesAvg}`,
        `${sizes
          .map(
            (size) =>
              data[user]?.[date]?.prSizes?.filter((prSize) => prSize === size)
                .length || 0
          )
          .join("/")}`,
      ];
    });

  const items =
    data.total?.[date]?.pullRequestsInfo
      ?.slice()
      ?.sort((a, b) => (b.sizePoints || 0) - (a.sizePoints || 0))
      .slice(0, parseInt(getValueAsIs("TOP_LIST_AMOUNT")))
      .map((item) => ({
        text: `${item.title}(+${item.additions}/-${item.deletions})(Author: ${item.author})`,
        link: item.link || "",
      })) || [];

  return [
    createTable({
      title: `Contribution stats ${date}`,
      description:
        "**Reviews conducted** - number of reviews conducted. 1 PR may have only single review.\n**PR Size** - determined using the formula: `additions + deletions * 0.2`. Based on this calculation: 0-50: xs, 51-200: s, 201-400: m, 401-700: l, 701+: xl\n**Total reverted PRs** - The number of reverted PRs based on the branch name pattern `/^revert-d+/`. This pattern is used for reverts made via GitHub.\n**Stale / Abandoned PRs** - PRs that were open longer than the configured threshold or were closed without merging.\n**Avg commits / files changed** - arithmetic mean per PR that helps highlight authors who send noisy updates.",
      table: {
        headers: [
          "user",
          totalOpenedPrsHeader,
          totalMergedPrsHeader,
          totalRevertedPrsHeader,
          staleAbandonedHeader,
          unreviewedPrsHeader,
          unapprovedPrsHeader,
          additionsDeletionsHeader,
          commitsFilesChangedHeader,
          prSizesHeader,
        ],
        rows: tableRowsTotal,
      },
    }),
    createList("The largest PRs", items),
  ].join("\n");
};
