type ReviewEvent = {
  state?: string;
  submitted_at?: string;
  created_at?: string;
};

type TimelineEvent = {
  event?: string;
  created_at?: string;
};

export type ReviewCycleMeta = {
  cycleCount: number;
  firstChangeRequestTime: string | null;
  firstUpdateAfterChangeRequest: string | null;
};

const normalizeDate = (value?: string) =>
  value ? new Date(value).getTime() : null;

export const calcReviewCycles = (
  reviews: ReviewEvent[] = [],
  timelineEvents: TimelineEvent[] = []
): ReviewCycleMeta => {
  const changeRequests = reviews
    .filter(
      (review) =>
        (review?.state || "").toLowerCase() === "changes_requested" &&
        (review?.submitted_at || review?.created_at)
    )
    .sort((a, b) => {
      const aTime = normalizeDate(a.submitted_at || a.created_at || "");
      const bTime = normalizeDate(b.submitted_at || b.created_at || "");
      if (aTime === null || bTime === null) {
        return 0;
      }
      return aTime - bTime;
    });

  const commitEvents = timelineEvents
    .filter((event) => event.event === "committed" && event.created_at)
    .sort((a, b) => {
      const aTime = normalizeDate(a.created_at || "");
      const bTime = normalizeDate(b.created_at || "");
      if (aTime === null || bTime === null) {
        return 0;
      }
      return aTime - bTime;
    });

  let cycleCount = 0;
  changeRequests.forEach((review) => {
    const reviewTime = normalizeDate(review.submitted_at || review.created_at);
    if (reviewTime === null) return;
    const commitAfter = commitEvents.find((commit) => {
      const commitTime = normalizeDate(commit.created_at || "");
      return commitTime !== null && commitTime > reviewTime;
    });
    if (commitAfter) {
      cycleCount += 1;
    }
  });

  const firstChangeRequestTime =
    changeRequests[0]?.submitted_at ||
    changeRequests[0]?.created_at ||
    null;

  let firstUpdateAfterChangeRequest: string | null = null;
  if (firstChangeRequestTime) {
    const changeRequestTimeValue = normalizeDate(firstChangeRequestTime);
    firstUpdateAfterChangeRequest =
      commitEvents.find((commit) => {
        const commitTime = normalizeDate(commit.created_at || "");
        return (
          commitTime !== null &&
          changeRequestTimeValue !== null &&
          commitTime > changeRequestTimeValue
        );
      })?.created_at || null;
  }

  return {
    cycleCount,
    firstChangeRequestTime,
    firstUpdateAfterChangeRequest,
  };
};
