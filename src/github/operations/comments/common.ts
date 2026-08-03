import { getServerUrl, isGiteaInstance } from "../../api/config";

export const SPINNER_HTML =
  '<img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />';

export function createJobRunLink(
  owner: string,
  repo: string,
  runId: string,
): string {
  // Gitea does have an Actions UI, at the same /actions/runs/<id> path — the
  // previous "skip it, Gitea has no Actions UI" branch linked to the repo root
  // instead, which is why these comments carried no link to their own run.
  //
  // owner/repo is the repo the issue lives in, and callers pass
  // context.runId, which is GITHUB_RUN_NUMBER — neither addresses the run.
  // The workflow runs in GITHUB_REPOSITORY, and the URL takes the run's ID.
  // Both fall back to the passed values, which are correct on plain GitHub.
  const runRepo = process.env.GITHUB_REPOSITORY || `${owner}/${repo}`;
  const runRef = process.env.GITHUB_RUN_ID || runId;
  return `[View job run](${getServerUrl()}/${runRepo}/actions/runs/${runRef})`;
}

export function createBranchLink(
  owner: string,
  repo: string,
  branchName: string,
): string {
  // NOT the same structure: /tree/<branch> is GitHub's, Gitea serves the same
  // thing at /src/branch/<branch> and 404s on /tree/.
  const branchPath = isGiteaInstance() ? "src/branch" : "tree";
  const branchUrl = `${getServerUrl()}/${owner}/${repo}/${branchPath}/${branchName}`;
  return `\n[View branch](${branchUrl})`;
}

export function createCommentBody(
  jobRunLink: string,
  branchLink: string = "",
): string {
  return `Claude Code is working… ${SPINNER_HTML}

I'll analyze this and get back to you.

${jobRunLink}${branchLink}`;
}
