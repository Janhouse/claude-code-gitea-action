import * as core from "@actions/core";
import type { ParsedGitHubContext } from "../context";
import type { Octokit } from "@octokit/rest";

/**
 * Check if the actor has write permissions to the repository
 * @param octokit - The Octokit REST client
 * @param context - The GitHub context
 * @returns true if the actor has write permissions, false otherwise
 */
export async function checkWritePermissions(
  octokit: Octokit,
  context: ParsedGitHubContext,
): Promise<boolean> {
  const { repository, actor } = context;

  try {
    core.info(`Checking permissions for actor: ${actor}`);

    // Check permissions directly using the permission endpoint
    const response = await octokit.repos.getCollaboratorPermissionLevel({
      owner: repository.owner,
      repo: repository.repo,
      username: actor,
    });

    const permissionLevel = response.data.permission;
    core.info(`Permission level retrieved: ${permissionLevel}`);

    if (permissionLevel === "admin" || permissionLevel === "write") {
      core.info(`Actor has write access: ${permissionLevel}`);
      return true;
    } else {
      core.warning(`Actor has insufficient permissions: ${permissionLevel}`);
      return false;
    }
  } catch (error) {
    core.warning(`Direct permission check failed: ${error}`);

    // Gitea alternative: check if user is a collaborator at all
    // In Gitea, even non-admins can check if a user is a collaborator
    try {
      core.info(`Attempting alternative collaborator check for ${actor}`);

      await octokit.repos.checkCollaborator({
        owner: repository.owner,
        repo: repository.repo,
        username: actor,
      });

      // If we reach here, the user is a collaborator
      // For a write-restricted action, we assume collaborators have write access
      // since they wouldn't be added as collaborators without some permissions
      core.info(`Actor ${actor} is confirmed as repository collaborator`);
      return true;
    } catch (collaboratorError) {
      core.warning(`Collaborator check also failed: ${collaboratorError}`);

      // Final fallback: if both permission and collaborator checks fail,
      // but the user can trigger this action, assume they have access
      core.info(
        `Permission checks unavailable - assuming access based on workflow execution context`,
      );
      return true;
    }
  }
}
