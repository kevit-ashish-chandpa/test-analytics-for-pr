import { calcReviewCycles } from "./calcReviewCycles";

describe("calcReviewCycles", () => {
  it("counts cycles only when a commit follows a changes requested review", () => {
    const reviews = [
      {
        state: "CHANGES_REQUESTED",
        submitted_at: "2024-01-01T00:00:00Z",
      },
      { state: "APPROVED", submitted_at: "2024-01-02T00:00:00Z" },
      {
        state: "changes_requested",
        submitted_at: "2024-01-03T00:00:00Z",
      },
    ];
    const timelineEvents = [
      { event: "committed", created_at: "2024-01-01T05:00:00Z" },
      { event: "committed", created_at: "2024-01-04T05:00:00Z" },
    ];
    const result = calcReviewCycles(reviews, timelineEvents);

    expect(result.cycleCount).toBe(2);
    expect(result.firstChangeRequestTime).toBe("2024-01-01T00:00:00Z");
    expect(result.firstUpdateAfterChangeRequest).toBe(
      "2024-01-01T05:00:00Z"
    );
  });

  it("returns zero cycles when no commits follow changes requested reviews", () => {
    const reviews = [
      {
        state: "CHANGES_REQUESTED",
        submitted_at: "2024-01-01T00:00:00Z",
      },
    ];

    const result = calcReviewCycles(reviews, [
      { event: "committed", created_at: "2023-12-31T23:59:00Z" },
    ]);

    expect(result.cycleCount).toBe(0);
    expect(result.firstUpdateAfterChangeRequest).toBeNull();
  });
});
