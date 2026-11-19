import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { checkAndCommitOrDeleteBranch } from "../src/github/operations/branch-cleanup";
import type { Octokits } from "../src/github/api/client";
import { GITHUB_SERVER_URL } from "../src/github/api/config";

describe("checkAndCommitOrDeleteBranch", () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const createMockOctokit = (
    compareResponse?: any,
    deleteRefError?: Error,
    branchExists: boolean = true,
  ): Octokits => {
    return {
      rest: {
        repos: {
          compareCommitsWithBasehead: async () => ({
            data: compareResponse || { total_commits: 0 },
          }),
          // Gitea's branch API: the head commit is `commit.id` (no `sha`).
          // The Claude branch sits on the base commit unless the compare
          // response says Claude committed something.
          getBranch: async ({ branch }: { branch: string }) => {
            if (!branchExists) {
              const error: any = new Error("Not Found");
              error.status = 404;
              throw error;
            }
            const claudeCommitted = (compareResponse?.total_commits ?? 0) > 0;
            const id =
              branch === "main" || !claudeCommitted ? "base-sha" : "claude-sha";
            return { data: { name: branch, commit: { id } } };
          },
        },
        git: {
          deleteRef: async () => {
            if (deleteRefError) {
              throw deleteRefError;
            }
            return { data: {} };
          },
        },
      },
    } as any as Octokits;
  };

  test("should return no branch link and not delete when branch is undefined", async () => {
    const mockOctokit = createMockOctokit();
    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      undefined,
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test("should mark branch for deletion when commit signing is enabled and no commits", async () => {
    const mockOctokit = createMockOctokit({ total_commits: 0 });
    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      true, // commit signing enabled
    );

    expect(result.shouldDeleteBranch).toBe(true);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Branch claude/issue-123-20240101-1234 has no commits from Claude, will delete it",
    );
  });

  test("should not delete branch and return link when branch has commits", async () => {
    const mockOctokit = createMockOctokit({ total_commits: 3 });
    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe(
      `\n[View branch](${GITHUB_SERVER_URL}/owner/repo/tree/claude/issue-123-20240101-1234)`,
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("has no commits"),
    );
  });

  test("should handle branch comparison errors gracefully", async () => {
    const mockOctokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: async () => {
            throw new Error("API error");
          },
          // The branch exists; comparing its head with the base fails.
          getBranch: (() => {
            let calls = 0;
            return async () => {
              calls++;
              if (calls === 1) return { data: { commit: { id: "x" } } };
              throw new Error("API error");
            };
          })(),
        },
        git: {
          deleteRef: async () => ({ data: {} }),
        },
      },
    } as any as Octokits;

    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe(
      `\n[View branch](${GITHUB_SERVER_URL}/owner/repo/tree/claude/issue-123-20240101-1234)`,
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error comparing commits on Claude branch:",
      expect.any(Error),
    );
  });

  test("should handle branch deletion errors gracefully", async () => {
    const deleteError = new Error("Delete failed");
    const mockOctokit = createMockOctokit({ total_commits: 0 }, deleteError);

    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      true, // commit signing enabled - will try to delete
    );

    expect(result.shouldDeleteBranch).toBe(true);
    expect(result.branchLink).toBe("");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to delete branch claude/issue-123-20240101-1234:",
      deleteError,
    );
  });

  test("should return no branch link when branch doesn't exist remotely", async () => {
    const mockOctokit = createMockOctokit(
      { total_commits: 0 },
      undefined,
      false, // branch doesn't exist
    );

    const result = await checkAndCommitOrDeleteBranch(
      mockOctokit,
      "owner",
      "repo",
      "claude/issue-123-20240101-1234",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Branch claude/issue-123-20240101-1234 does not exist remotely",
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "Branch claude/issue-123-20240101-1234 does not exist remotely, no branch link will be added",
    );
  });
});
