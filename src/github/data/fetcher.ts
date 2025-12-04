import { execFileSync } from "child_process";
import type { Octokits } from "../api/client";
import type {
  GitHubComment,
  GitHubFile,
  GitHubIssue,
  GitHubPullRequest,
  GitHubReview,
} from "../types";
import type { CommentWithImages } from "../utils/image-downloader";
import { downloadCommentImages } from "../utils/image-downloader";

type FetchDataParams = {
  octokits: Octokits;
  repository: string;
  prNumber: string;
  isPR: boolean;
  triggerUsername?: string;
};

export type GitHubFileWithSHA = GitHubFile & {
  sha: string;
};

export type FetchDataResult = {
  contextData: GitHubPullRequest | GitHubIssue;
  comments: GitHubComment[];
  changedFiles: GitHubFile[];
  changedFilesWithSHA: GitHubFileWithSHA[];
  reviewData: { nodes: GitHubReview[] } | null;
  imageUrlMap: Map<string, string>;
  triggerDisplayName?: string | null;
};

export async function fetchGitHubData({
  octokits,
  repository,
  prNumber,
  isPR,
  triggerUsername,
}: FetchDataParams): Promise<FetchDataResult> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repository format. Expected 'owner/repo'.");
  }

  let contextData: GitHubPullRequest | GitHubIssue | null = null;
  let comments: GitHubComment[] = [];
  let changedFiles: GitHubFile[] = [];
  let reviewData: { nodes: GitHubReview[] } | null = null;

  try {
    // Use REST API for all requests (works with both GitHub and Gitea)
    if (isPR) {
      console.log(`Fetching PR #${prNumber} data using REST API`);
      const prResponse = await octokits.rest.pulls.get({
        owner,
        repo,
        pull_number: parseInt(prNumber),
      });

      contextData = {
        title: prResponse.data.title,
        body: prResponse.data.body || "",
        author: { login: prResponse.data.user?.login || "" },
        baseRefName: prResponse.data.base.ref,
        headRefName: prResponse.data.head.ref,
        headRefOid: prResponse.data.head.sha,
        createdAt: prResponse.data.created_at,
        additions: prResponse.data.additions || 0,
        deletions: prResponse.data.deletions || 0,
        state: prResponse.data.state.toUpperCase(),
        commits: { totalCount: 0, nodes: [] },
        files: { nodes: [] },
        comments: { nodes: [] },
        reviews: { nodes: [] },
      };

      // Fetch comments separately
      try {
        const commentsResponse = await octokits.rest.issues.listComments({
          owner,
          repo,
          issue_number: parseInt(prNumber),
        });
        comments = commentsResponse.data.map((comment: any) => ({
          id: comment.id.toString(),
          databaseId: comment.id.toString(),
          body: comment.body || "",
          author: { login: comment.user?.login || "" },
          createdAt: comment.created_at,
        }));
      } catch (error) {
        console.warn("Failed to fetch PR comments:", error);
        comments = []; // Ensure we have an empty array
      }

      // Try to fetch files
      try {
        const filesResponse = await octokits.rest.pulls.listFiles({
          owner,
          repo,
          pull_number: parseInt(prNumber),
        });
        changedFiles = filesResponse.data.map((file: any) => ({
          path: file.filename,
          additions: file.additions || 0,
          deletions: file.deletions || 0,
          changeType: file.status?.toUpperCase() || "MODIFIED",
        }));
      } catch (error) {
        console.warn("Failed to fetch PR files:", error);
        changedFiles = []; // Ensure we have an empty array
      }

      reviewData = { nodes: [] }; // Simplified for Gitea compatibility
    } else {
      console.log(`Fetching issue #${prNumber} data using REST API`);
      const issueResponse = await octokits.rest.issues.get({
        owner,
        repo,
        issue_number: parseInt(prNumber),
      });

      contextData = {
        title: issueResponse.data.title,
        body: issueResponse.data.body || "",
        author: { login: issueResponse.data.user?.login || "" },
        createdAt: issueResponse.data.created_at,
        state: issueResponse.data.state.toUpperCase(),
        comments: { nodes: [] },
      };

      // Fetch comments
      try {
        const commentsResponse = await octokits.rest.issues.listComments({
          owner,
          repo,
          issue_number: parseInt(prNumber),
        });
        comments = commentsResponse.data.map((comment: any) => ({
          id: comment.id.toString(),
          databaseId: comment.id.toString(),
          body: comment.body || "",
          author: { login: comment.user?.login || "" },
          createdAt: comment.created_at,
        }));
      } catch (error) {
        console.warn("Failed to fetch issue comments:", error);
        comments = []; // Ensure we have an empty array
      }
    }
  } catch (error) {
    console.error(`Failed to fetch ${isPR ? "PR" : "issue"} data:`, error);
    throw new Error(`Failed to fetch ${isPR ? "PR" : "issue"} data`);
  }

  // Compute SHAs for changed files
  let changedFilesWithSHA: GitHubFileWithSHA[] = [];
  if (isPR && changedFiles.length > 0) {
    changedFilesWithSHA = changedFiles.map((file) => {
      // Don't compute SHA for deleted files
      if (file.changeType === "DELETED") {
        return {
          ...file,
          sha: "deleted",
        };
      }

      try {
        // Use git hash-object to compute the SHA for the current file content
        const sha = execFileSync("git", ["hash-object", file.path], {
          encoding: "utf-8",
        }).trim();
        return {
          ...file,
          sha,
        };
      } catch (error) {
        console.warn(`Failed to compute SHA for ${file.path}:`, error);
        // Return original file without SHA if computation fails
        return {
          ...file,
          sha: "unknown",
        };
      }
    });
  }

  // Prepare all comments for image processing
  const issueComments: CommentWithImages[] = comments
    .filter((c) => c.body)
    .map((c) => ({
      type: "issue_comment" as const,
      id: c.databaseId,
      body: c.body,
    }));

  const reviewBodies: CommentWithImages[] =
    reviewData?.nodes
      ?.filter((r) => r.body)
      .map((r) => ({
        type: "review_body" as const,
        id: r.databaseId,
        pullNumber: prNumber,
        body: r.body,
      })) ?? [];

  const reviewComments: CommentWithImages[] =
    reviewData?.nodes
      ?.flatMap((r) => r.comments?.nodes ?? [])
      .filter((c) => c.body)
      .map((c) => ({
        type: "review_comment" as const,
        id: c.databaseId,
        body: c.body,
      })) ?? [];

  // Add the main issue/PR body if it has content
  const mainBody: CommentWithImages[] = contextData.body
    ? [
        {
          ...(isPR
            ? {
                type: "pr_body" as const,
                pullNumber: prNumber,
                body: contextData.body,
              }
            : {
                type: "issue_body" as const,
                issueNumber: prNumber,
                body: contextData.body,
              }),
        },
      ]
    : [];

  const allComments = [
    ...mainBody,
    ...issueComments,
    ...reviewBodies,
    ...reviewComments,
  ];

  const imageUrlMap = await downloadCommentImages(
    octokits,
    owner,
    repo,
    allComments,
  );

  // Fetch trigger user display name if username is provided
  let triggerDisplayName: string | null | undefined;
  if (triggerUsername) {
    triggerDisplayName = await fetchUserDisplayName(octokits, triggerUsername);
  }

  return {
    contextData,
    comments,
    changedFiles,
    changedFilesWithSHA,
    reviewData,
    imageUrlMap,
    triggerDisplayName,
  };
}

export async function fetchUserDisplayName(
  octokits: Octokits,
  login: string,
): Promise<string | null> {
  try {
    const result = await octokits.rest.users.getByUsername({
      username: login,
    });
    return result.data.name;
  } catch (error) {
    console.warn(`Failed to fetch user display name for ${login}:`, error);
    return null;
  }
}
