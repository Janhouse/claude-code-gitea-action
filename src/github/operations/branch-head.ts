/**
 * The commit a branch points at, from a `repos.getBranch` response.
 *
 * GitHub returns it as `commit.sha`; Gitea's branch API returns `commit.id`
 * and no `sha`. Reading only `sha` made every Gitea branch look like
 * `undefined`, so two different branches compared equal and branch cleanup
 * deleted Claude's branch (closing any pull request opened from it).
 */
export function branchHeadSha(branch: {
  commit?: { sha?: string | null; id?: string | null } | null;
}): string | undefined {
  return branch.commit?.sha ?? branch.commit?.id ?? undefined;
}

/**
 * Whether two branch heads differ. When either head is unknown the answer is
 * "yes": callers use this to decide whether a branch is empty and may be
 * deleted, and an unknown head must never lead to a deletion.
 */
export function branchHeadsDiffer(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (!a || !b) return true;
  return a !== b;
}
