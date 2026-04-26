#!/usr/bin/env bun

/**
 * Configure git authentication for non-signing mode
 * Sets up git user and authentication to work with GitHub App tokens
 */

import { $ } from "bun";
import type { ParsedGitHubContext } from "../context";
import { getServerUrl } from "../api/config";

type GitUser = {
  login: string;
  id: number;
};

export async function configureGitAuth(
  githubToken: string,
  context: ParsedGitHubContext,
  user: GitUser | null,
) {
  console.log("Configuring git authentication for non-signing mode");

  // Determine the noreply email domain based on server URL
  const serverUrl = new URL(getServerUrl());
  const noreplyDomain =
    serverUrl.hostname === "github.com"
      ? "users.noreply.github.com"
      : `users.noreply.${serverUrl.hostname}`;

  // Allow callers to override the default git author. Useful when the
  // auto-generated `<id>+<name>@users.noreply.<host>` pattern looks
  // ugly on a self-hosted Gitea (e.g. `9+claude@users.noreply.git.example.com`).
  const overrideName = process.env.GIT_USER_NAME?.trim();
  const overrideEmail = process.env.GIT_USER_EMAIL?.trim();

  // Configure git user based on the comment creator
  console.log("Configuring git user...");
  if (overrideName || overrideEmail) {
    const name = overrideName || user?.login || "github-actions[bot]";
    const email =
      overrideEmail ||
      (user
        ? `${user.id}+${user.login}@${noreplyDomain}`
        : `41898282+github-actions[bot]@${noreplyDomain}`);
    console.log(`Setting git user from override: ${name} <${email}>`);
    await $`git config user.name "${name}"`;
    await $`git config user.email "${email}"`;
  } else if (user) {
    const botName = user.login;
    const botId = user.id;
    console.log(`Setting git user as ${botName}...`);
    await $`git config user.name "${botName}"`;
    await $`git config user.email "${botId}+${botName}@${noreplyDomain}"`;
    console.log(`✓ Set git user as ${botName}`);
  } else {
    console.log("No user data in comment, using default bot user");
    await $`git config user.name "github-actions[bot]"`;
    await $`git config user.email "41898282+github-actions[bot]@${noreplyDomain}"`;
  }

  // Remove the authorization header that actions/checkout sets
  console.log("Removing existing git authentication headers...");
  try {
    await $`git config --unset-all http.${getServerUrl()}/.extraheader`;
    console.log("✓ Removed existing authentication headers");
  } catch (e) {
    console.log("No existing authentication headers to remove");
  }

  // Update the remote URL to include the token for authentication
  console.log("Updating remote URL with authentication...");
  const remoteUrl = `https://x-access-token:${githubToken}@${serverUrl.host}/${context.repository.owner}/${context.repository.repo}.git`;
  await $`git remote set-url origin ${remoteUrl}`;
  console.log("✓ Updated remote URL with authentication token");

  console.log("Git authentication configured successfully");
}
