import { describe, expect, test } from "bun:test";
import {
  branchHeadSha,
  branchHeadsDiffer,
} from "../src/github/operations/branch-head";

describe("branchHeadSha", () => {
  test("GitHub: commit.sha", () => {
    expect(branchHeadSha({ commit: { sha: "abc123" } })).toBe("abc123");
  });

  test("Gitea: commit.id (no sha)", () => {
    expect(branchHeadSha({ commit: { id: "def456" } })).toBe("def456");
  });

  test("missing commit is undefined", () => {
    expect(branchHeadSha({})).toBeUndefined();
    expect(branchHeadSha({ commit: null })).toBeUndefined();
  });
});

describe("branchHeadsDiffer", () => {
  test("two Gitea branches on different commits differ", () => {
    const main = branchHeadSha({ commit: { id: "aaa" } });
    const claude = branchHeadSha({ commit: { id: "bbb" } });
    expect(branchHeadsDiffer(main, claude)).toBe(true);
  });

  test("same commit does not differ", () => {
    expect(branchHeadsDiffer("aaa", "aaa")).toBe(false);
  });

  // The old code compared undefined === undefined and deleted the branch.
  test("unknown heads count as different, so nothing is deleted", () => {
    expect(branchHeadsDiffer(undefined, undefined)).toBe(true);
    expect(branchHeadsDiffer("aaa", undefined)).toBe(true);
  });
});
