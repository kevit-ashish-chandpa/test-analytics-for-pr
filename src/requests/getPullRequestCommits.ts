import { octokit } from "../octokit";
import { commonHeaders } from "./constants";
import { Repository } from "./types";

export const getPullRequestCommits = async (
  pullRequestNumbers: number[],
  repository: Repository
) => {
  const { owner, repo } = repository;

  return pullRequestNumbers.map(async (number) => {
    const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
      owner,
      repo,
      pull_number: number,
      headers: commonHeaders,
      per_page: 100,
    });

    return { data: commits };
  });
};
