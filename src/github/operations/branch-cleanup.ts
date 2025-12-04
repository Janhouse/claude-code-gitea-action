import type { Octokits } from "../api/client";
import { getServerUrl, isGiteaInstance } from "../api/config";
import { $ } from "bun";

export async function checkAndCommitOrDeleteBranch(
  octokit: Octokits,
  owner: string,
  repo: string,
  claudeBranch: string | undefined,
  baseBranch: string,
  useCommitSigning: boolean,
): Promise<{ shouldDeleteBranch: boolean; branchLink: string }> {
  let branchLink = "";
  let shouldDeleteBranch = false;

  if (claudeBranch) {
    // First check if the branch exists remotely
    let branchExistsRemotely = false;
    try {
      await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: claudeBranch,
      });
      branchExistsRemotely = true;
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Branch ${claudeBranch} does not exist remotely`);
      } else {
        console.error("Error checking if branch exists:", error);
      }
    }

    // Only proceed if branch exists remotely
    if (!branchExistsRemotely) {
      console.log(
        `Branch ${claudeBranch} does not exist remotely, no branch link will be added`,
      );
      return { shouldDeleteBranch: false, branchLink: "" };
    }

    // Check if Claude made any commits to the branch
    try {
      // Since Gitea doesn't have compareCommitsWithBasehead, use branch commit info
      const [baseBranchInfo, claudeBranchInfo] = await Promise.all([
        octokit.rest.repos.getBranch({ owner, repo, branch: baseBranch }),
        octokit.rest.repos.getBranch({ owner, repo, branch: claudeBranch }),
      ]);

      // Compare commit SHAs to see if there are any differences
      const baseSHA = baseBranchInfo.data.commit.sha;
      const claudeSHA = claudeBranchInfo.data.commit.sha;
      const hasCommits = baseSHA !== claudeSHA;

      // If there are no commits, check for uncommitted changes if not using commit signing
      if (!hasCommits) {
        if (!useCommitSigning) {
          console.log(
            `Branch ${claudeBranch} has no commits from Claude, checking for uncommitted changes...`,
          );

          // Check for uncommitted changes using git status
          try {
            const gitStatus = await $`git status --porcelain`.quiet();
            const hasUncommittedChanges =
              gitStatus.stdout.toString().trim().length > 0;

            if (hasUncommittedChanges) {
              console.log("Found uncommitted changes, committing them...");

              // Add all changes but exclude output.txt (temporary file from Claude execution)
              await $`git add -A`;
              try {
                // Remove output.txt from staging if it exists
                await $`git reset HEAD output.txt`.quiet();
              } catch {
                // Ignore if output.txt doesn't exist in staging
              }

              // Check if there are still staged changes after excluding output.txt
              const stagedChanges =
                await $`git diff --cached --name-only`.quiet();
              const hasStagedChanges =
                stagedChanges.stdout.toString().trim().length > 0;

              if (hasStagedChanges) {
                // Commit with a descriptive message
                const runId = process.env.GITHUB_RUN_NUMBER || "unknown";
                const commitMessage = `Auto-commit: Save uncommitted changes from Claude\n\nRun ID: ${runId}`;
                await $`git commit -m ${commitMessage}`;

                // Push the changes
                await $`git push origin ${claudeBranch}`;

                console.log(
                  "✅ Successfully committed and pushed uncommitted changes",
                );

                // Set branch link since we now have commits
                const branchUrl = `${getServerUrl()}/${owner}/${repo}/tree/${claudeBranch}`;
                branchLink = `\n[View branch](${branchUrl})`;
              } else {
                console.log(
                  "No significant changes to commit (only temporary files), marking branch for deletion",
                );
                shouldDeleteBranch = true;
              }
            } else {
              console.log(
                "No uncommitted changes found, marking branch for deletion",
              );
              shouldDeleteBranch = true;
            }
          } catch (gitError) {
            console.error("Error checking/committing changes:", gitError);
            // If we can't check git status, assume the branch might have changes
            const branchUrl = `${getServerUrl()}/${owner}/${repo}/tree/${claudeBranch}`;
            branchLink = `\n[View branch](${branchUrl})`;
          }
        } else {
          console.log(
            `Branch ${claudeBranch} has no commits from Claude, will delete it`,
          );
          shouldDeleteBranch = true;
        }
      } else {
        // Only add branch link if there are commits
        const branchUrl = `${getServerUrl()}/${owner}/${repo}/tree/${claudeBranch}`;
        branchLink = `\n[View branch](${branchUrl})`;
      }
    } catch (error) {
      console.error("Error comparing commits on Claude branch:", error);
      // If we can't compare but the branch exists remotely, include the branch link
      const branchUrl = `${getServerUrl()}/${owner}/${repo}/tree/${claudeBranch}`;
      branchLink = `\n[View branch](${branchUrl})`;
    }
  }

  // Delete the branch if it has no commits
  if (shouldDeleteBranch && claudeBranch) {
    try {
      if (isGiteaInstance()) {
        // Gitea uses the branches API for deletion
        const response = await fetch(
          `${process.env.GITEA_API_URL}/repos/${owner}/${repo}/branches/${encodeURIComponent(claudeBranch)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to delete branch: ${response.status} ${response.statusText}`,
          );
        }
      } else {
        // GitHub uses git refs API for deletion
        await octokit.rest.git.deleteRef({
          owner,
          repo,
          ref: `heads/${claudeBranch}`,
        });
      }
      console.log(`✅ Deleted empty branch: ${claudeBranch}`);
    } catch (deleteError) {
      console.error(`Failed to delete branch ${claudeBranch}:`, deleteError);
      // Continue even if deletion fails
    }
  }

  return { shouldDeleteBranch, branchLink };
}
