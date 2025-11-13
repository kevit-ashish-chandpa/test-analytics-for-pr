import {
  isAbandonedPullRequest,
  isStalePullRequest,
} from "./isStalePullRequest";

describe("isStalePullRequest", () => {
  it("detects stale open pull requests older than threshold", () => {
    const pullRequest = {
      created_at: "2023-12-01T00:00:00Z",
      state: "open",
    };
    const result = isStalePullRequest(
      pullRequest,
      5,
      new Date("2023-12-10T00:00:00Z")
    );
    expect(result).toBe(true);
  });

  it("skips recently opened pull requests", () => {
    const pullRequest = {
      created_at: "2023-12-05T00:00:00Z",
      state: "open",
    };
    const result = isStalePullRequest(
      pullRequest,
      10,
      new Date("2023-12-10T00:00:00Z")
    );
    expect(result).toBe(false);
  });
});

describe("isAbandonedPullRequest", () => {
  it("flags closed pull requests without a merge", () => {
    const pullRequest = {
      created_at: "2023-11-01T00:00:00Z",
      state: "closed",
      merged: false,
    };
    expect(isAbandonedPullRequest(pullRequest)).toBe(true);
  });

  it("does not flag merged pull requests", () => {
    const pullRequest = {
      state: "closed",
      merged: true,
    };
    expect(isAbandonedPullRequest(pullRequest)).toBe(false);
  });
});
