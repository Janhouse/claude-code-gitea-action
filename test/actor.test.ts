import { afterEach, describe, expect, test } from "bun:test";
import type { Octokit } from "@octokit/rest";
import type { ParsedGitHubContext } from "../src/github/context";
import { checkHumanActor } from "../src/github/validation/actor";

function octokitReturning(type: string | undefined) {
  return {
    users: { getByUsername: async () => ({ data: { type } }) },
  } as unknown as Octokit;
}
const ctx = (actor: string) => ({ actor }) as ParsedGitHubContext;

describe("checkHumanActor", () => {
  afterEach(() => {
    delete process.env.ALLOWED_BOTS;
  });

  test("User passes", async () => {
    await expect(
      checkHumanActor(octokitReturning("User"), ctx("alice")),
    ).resolves.toBeUndefined();
  });

  test("missing type (Gitea < 28) passes", async () => {
    await expect(
      checkHumanActor(octokitReturning(undefined), ctx("alice")),
    ).resolves.toBeUndefined();
  });

  test("Bot is refused by default", async () => {
    await expect(
      checkHumanActor(octokitReturning("Bot"), ctx("claude")),
    ).rejects.toThrow("non-human actor");
  });

  test("Bot listed in ALLOWED_BOTS passes, case-insensitively", async () => {
    process.env.ALLOWED_BOTS = "bot, Claude";
    await expect(
      checkHumanActor(octokitReturning("Bot"), ctx("claude")),
    ).resolves.toBeUndefined();
  });

  test("Bot not listed is still refused", async () => {
    process.env.ALLOWED_BOTS = "bot";
    await expect(
      checkHumanActor(octokitReturning("Bot"), ctx("renovate")),
    ).rejects.toThrow("allowed_bots");
  });

  test("wildcard allows any Bot but never an Organization", async () => {
    process.env.ALLOWED_BOTS = "*";
    await expect(
      checkHumanActor(octokitReturning("Bot"), ctx("anything")),
    ).resolves.toBeUndefined();
    await expect(
      checkHumanActor(octokitReturning("Organization"), ctx("org")),
    ).rejects.toThrow();
  });
});
