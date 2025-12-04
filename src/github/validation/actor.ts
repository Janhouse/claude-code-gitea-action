#!/usr/bin/env bun

/**
 * Check if the action trigger is from a human actor
 * Prevents automated tools or bots from triggering Claude
 */

import type { Octokit } from "@octokit/rest";
import type { ParsedGitHubContext } from "../context";

export async function checkHumanActor(
  octokit: Octokit,
  githubContext: ParsedGitHubContext,
) {
  // Fetch user information from GitHub/Gitea API
  const { data: userData } = await octokit.users.getByUsername({
    username: githubContext.actor,
  });

  const actorType = userData.type;

  console.log(`Actor type: ${actorType}`);

  // GitHub returns type: "User" | "Bot" | "Organization"
  // Gitea doesn't return a type field, so we need to handle both cases
  if (actorType !== undefined && actorType !== "User") {
    throw new Error(
      `Workflow initiated by non-human actor: ${githubContext.actor} (type: ${actorType}).`,
    );
  }

  // For Gitea (where type is undefined), we assume human actor since:
  // 1. They successfully authenticated to trigger the workflow
  // 2. Gitea doesn't have the same bot detection mechanisms as GitHub
  // 3. The risk is lower in self-hosted environments

  if (actorType === undefined) {
    console.log(
      `Gitea user detected (no type field), assuming human actor: ${githubContext.actor}`,
    );
  } else {
    console.log(`Verified human actor: ${githubContext.actor}`);
  }
}
