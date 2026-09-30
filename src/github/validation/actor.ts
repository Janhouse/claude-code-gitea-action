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

  // GitHub returns type: "User" | "Bot" | "Organization". Gitea omitted the
  // field before 28.0.0; since then it returns the same enum, with "Bot" for
  // its token-only bot accounts. Bots are refused unless named in
  // `allowed_bots` (comma-separated logins, or "*"), like upstream's input.
  if (actorType === "Bot" && isAllowedBot(githubContext.actor)) {
    console.log(`Allowed bot actor: ${githubContext.actor}`);
    return;
  }
  if (actorType !== undefined && actorType !== "User") {
    throw new Error(
      `Workflow initiated by non-human actor: ${githubContext.actor} (type: ${actorType}). ` +
        `Add it to allowed_bots to permit it.`,
    );
  }

  // For Gitea < 28 (type is undefined), we assume human actor since:
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

function isAllowedBot(actor: string): boolean {
  const allowed = (process.env.ALLOWED_BOTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes("*") || allowed.includes(actor.toLowerCase());
}
