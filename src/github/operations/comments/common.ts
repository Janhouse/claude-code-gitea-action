import { getServerUrl, isGiteaInstance } from "../../api/config";

export const SPINNER_HTML =
  '<img src="https://github.com/user-attachments/assets/5ac382c7-e004-429b-8e35-7feb3e8f9c6f" width="14px" height="14px" style="vertical-align: middle; margin-left: 4px;" />';

export function createJobRunLink(
  owner: string,
  repo: string,
  runId: string,
): string {
  // For Gitea, use a different path structure or skip actions link if not supported
  const jobRunUrl = isGiteaInstance()
    ? `${getServerUrl()}/${owner}/${repo}` // Gitea doesn't have GitHub Actions UI
    : `${getServerUrl()}/${owner}/${repo}/actions/runs/${runId}`;
  const linkText = isGiteaInstance() ? "View repository" : "View job run";
  return `[${linkText}](${jobRunUrl})`;
}

export function createBranchLink(
  owner: string,
  repo: string,
  branchName: string,
): string {
  // Both GitHub and Gitea use similar branch URL structure
  const branchUrl = `${getServerUrl()}/${owner}/${repo}/tree/${branchName}`;
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
