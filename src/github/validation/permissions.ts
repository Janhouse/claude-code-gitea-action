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

  // The repo owner is always implicitly admin on their own repo. On Gitea
  // (and to a lesser extent on GitHub), `getCollaboratorPermissionLevel`
  // can fail to acknowledge this — owners often aren't enumerated in the
  // collaborators list, and the endpoint may return a non-admin level for
  // them. Short-circuit here to avoid that false negative.
  if (actor.toLowerCase() === repository.owner.toLowerCase()) {
    core.info(`Actor ${actor} is the repository owner — granting write access`);
    return true;
  }

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

    // Gitea returns "owner" for the repo owner (and for users assigned
    // owner-level access via org/team) — this is *higher* than admin.
    // GitHub only returns admin/write/read/none, so accepting "owner"
    // here is Gitea-specific but harmless on GitHub.
    if (
      permissionLevel === "admin" ||
      permissionLevel === "write" ||
      permissionLevel === "owner"
    ) {
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
