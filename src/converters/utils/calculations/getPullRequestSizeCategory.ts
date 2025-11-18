export type PullRequestSizeCategory = "small" | "medium" | "large";

const filesThresholds = {
  small: 5,
  medium: 20,
};

const lineThresholds = {
  small: 250,
  medium: 1000,
};

export const getPullRequestSizeCategory = (
  additions: number | undefined,
  deletions: number | undefined,
  filesChanged: number | undefined
): PullRequestSizeCategory => {
  const totalChanges = (additions || 0) + (deletions || 0);
  const filesTouched = filesChanged || 0;

  if (
    totalChanges <= lineThresholds.small &&
    filesTouched <= filesThresholds.small
  ) {
    return "small";
  }

  if (
    totalChanges <= lineThresholds.medium &&
    filesTouched <= filesThresholds.medium
  ) {
    return "medium";
  }

  return "large";
};
