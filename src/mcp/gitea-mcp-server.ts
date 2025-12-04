#!/usr/bin/env node
// Gitea API Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from "node-fetch";
import { z } from "zod";

// Get configuration from environment variables
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const BRANCH_NAME = process.env.BRANCH_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITEA_API_URL = process.env.GITEA_API_URL || "https://api.github.com";

console.log(`[GITEA-MCP] Starting Gitea API Operations MCP Server`);
console.log(`[GITEA-MCP] REPO_OWNER: ${REPO_OWNER}`);
console.log(`[GITEA-MCP] REPO_NAME: ${REPO_NAME}`);
console.log(`[GITEA-MCP] BRANCH_NAME: ${BRANCH_NAME}`);
console.log(`[GITEA-MCP] GITEA_API_URL: ${GITEA_API_URL}`);
console.log(`[GITEA-MCP] GITHUB_TOKEN: ${GITHUB_TOKEN ? "***" : "undefined"}`);

if (!REPO_OWNER || !REPO_NAME || !GITHUB_TOKEN) {
  console.error(
    "[GITEA-MCP] Error: REPO_OWNER, REPO_NAME, and GITHUB_TOKEN environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea API Operations Server",
  version: "0.0.1",
});

// Helper function to make authenticated requests to Gitea API
async function giteaRequest(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const url = `${GITEA_API_URL}${endpoint}`;
  console.log(`[GITEA-MCP] Making ${method} request to: ${url}`);

  const headers: Record<string, string> = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`[GITEA-MCP] Response status: ${response.status}`);
  console.log(`[GITEA-MCP] Response: ${responseText.substring(0, 500)}...`);

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${responseText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : null;
}

// Get issue details
server.tool(
  "get_issue",
  "Get details of a specific issue",
  {
    issue_number: z.number().describe("The issue number to fetch"),
  },
  async ({ issue_number }) => {
    try {
      const issue = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting issue: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get issue comments
server.tool(
  "get_issue_comments",
  "Get comments for a specific issue",
  {
    issue_number: z.number().describe("The issue number to fetch comments for"),
  },
  async ({ issue_number }) => {
    try {
      const comments = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}/comments`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comments, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error getting issue comments: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error getting issue comments: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Create issue comment
server.tool(
  "create_issue_comment",
  "Create a comment on an issue",
  {
    issue_number: z.number().describe("The issue number to comment on"),
    body: z.string().describe("The comment body"),
  },
  async ({ issue_number, body }) => {
    try {
      const comment = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}/comments`,
        "POST",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: `Comment created successfully: ${JSON.stringify(comment, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error creating issue comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error creating issue comment: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Update issue comment
server.tool(
  "update_issue_comment",
  "Update an existing issue comment",
  {
    comment_id: z.number().describe("The comment ID to update"),
    body: z.string().describe("The new comment body"),
  },
  async ({ comment_id, body }) => {
    try {
      const comment = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${comment_id}`,
        "PATCH",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: `Comment updated successfully: ${JSON.stringify(comment, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error updating issue comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error updating issue comment: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get pull request details
server.tool(
  "get_pull_request",
  "Get details of a specific pull request",
  {
    pr_number: z.number().describe("The pull request number to fetch"),
  },
  async ({ pr_number }) => {
    try {
      const pr = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr_number}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pr, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting pull request: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get pull request files
server.tool(
  "get_pull_request_files",
  "Get files changed in a pull request",
  {
    pr_number: z
      .number()
      .describe("The pull request number to fetch files for"),
  },
  async ({ pr_number }) => {
    try {
      const files = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr_number}/files`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(files, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error getting pull request files: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error getting pull request files: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get file contents
server.tool(
  "get_file_contents",
  "Get the contents of a file from the repository",
  {
    path: z.string().describe("The file path to fetch"),
    ref: z.string().optional().describe("The branch or commit ref (optional)"),
  },
  async ({ path, ref }) => {
    try {
      let endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`;
      if (ref) {
        endpoint += `?ref=${encodeURIComponent(ref)}`;
      }

      const file = (await giteaRequest(endpoint)) as {
        content?: string;
        encoding?: string;
      };

      // Decode base64 content if it's a file
      if (file.content && file.encoding === "base64") {
        const decodedContent = Buffer.from(file.content, "base64").toString(
          "utf-8",
        );
        return {
          content: [
            {
              type: "text",
              text: `File: ${path}\n\n${decodedContent}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(file, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting file contents: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting file contents: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// List repository branches
server.tool(
  "list_branches",
  "List all branches in the repository",
  {},
  async () => {
    try {
      const branches = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/branches`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(branches, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing branches: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing branches: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Create a new branch
server.tool(
  "create_branch",
  "Create a new branch in the repository",
  {
    new_branch_name: z.string().describe("Name of the new branch to create"),
    old_branch_name: z.string().describe("Name of the source branch"),
  },
  async ({ new_branch_name, old_branch_name }) => {
    try {
      const branch = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/branches`,
        "POST",
        {
          new_branch_name,
          old_branch_name,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: `Branch created successfully: ${JSON.stringify(branch, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error creating branch: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error creating branch: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Update Claude comment (convenience tool that uses the CLAUDE_COMMENT_ID automatically)
server.tool(
  "update_claude_comment",
  "Update the Claude comment with progress and results (automatically uses the Claude comment ID)",
  {
    body: z.string().describe("The updated comment content"),
  },
  async ({ body }) => {
    try {
      const claudeCommentId = process.env.CLAUDE_COMMENT_ID;

      if (!claudeCommentId) {
        throw new Error("CLAUDE_COMMENT_ID environment variable is required");
      }

      const comment_id = parseInt(claudeCommentId, 10);
      const comment = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${comment_id}`,
        "PATCH",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: `Claude comment updated successfully: ${JSON.stringify(comment, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error updating Claude comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error updating Claude comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Delete an issue comment
server.tool(
  "delete_issue_comment",
  "Delete an issue comment",
  {
    comment_id: z.number().describe("The comment ID to delete"),
  },
  async ({ comment_id }) => {
    try {
      await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${comment_id}`,
        "DELETE",
      );

      return {
        content: [
          {
            type: "text",
            text: `Comment ${comment_id} deleted successfully`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error deleting issue comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error deleting issue comment: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// List issues
server.tool(
  "list_issues",
  "List issues in the repository",
  {
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Filter by state (open, closed, all)"),
    labels: z
      .string()
      .optional()
      .describe("Comma-separated list of label names"),
    page: z.number().optional().describe("Page number"),
    limit: z.number().optional().describe("Number of items per page"),
  },
  async ({ state, labels, page, limit }) => {
    try {
      const params = new URLSearchParams();
      if (state) params.append("state", state);
      if (labels) params.append("labels", labels);
      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      let endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/issues`;
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const issues = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issues, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing issues: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing issues: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Create issue
server.tool(
  "create_issue",
  "Create a new issue in the repository",
  {
    title: z.string().describe("The issue title"),
    body: z.string().optional().describe("The issue body"),
    labels: z
      .array(z.string())
      .optional()
      .describe("Array of label names to add"),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Array of usernames to assign"),
  },
  async ({ title, body, labels, assignees }) => {
    try {
      const issue = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
        "POST",
        { title, body, labels, assignees },
      );

      return {
        content: [
          {
            type: "text",
            text: `Issue created successfully: ${JSON.stringify(issue, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error creating issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error creating issue: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Update issue
server.tool(
  "update_issue",
  "Update an existing issue",
  {
    issue_number: z.number().describe("The issue number to update"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body"),
    state: z.enum(["open", "closed"]).optional().describe("New state"),
    labels: z
      .array(z.string())
      .optional()
      .describe("New labels (replaces existing)"),
  },
  async ({ issue_number, title, body, state, labels }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (body !== undefined) updateData.body = body;
      if (state !== undefined) updateData.state = state;
      if (labels !== undefined) updateData.labels = labels;

      const issue = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}`,
        "PATCH",
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: `Issue updated successfully: ${JSON.stringify(issue, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error updating issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error updating issue: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get repository info
server.tool("get_repository", "Get repository information", {}, async () => {
  try {
    const repo = await giteaRequest(`/repos/${REPO_OWNER}/${REPO_NAME}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(repo, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GITEA-MCP] Error getting repository: ${errorMessage}`);
    return {
      content: [
        {
          type: "text",
          text: `Error getting repository: ${errorMessage}`,
        },
      ],
    };
  }
});

// List pull requests
server.tool(
  "list_pull_requests",
  "List pull requests in the repository",
  {
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Filter by state"),
    page: z.number().optional().describe("Page number"),
    limit: z.number().optional().describe("Number of items per page"),
  },
  async ({ state, page, limit }) => {
    try {
      const params = new URLSearchParams();
      if (state) params.append("state", state);
      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      let endpoint = `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`;
      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const prs = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(prs, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing pull requests: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing pull requests: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Create pull request
server.tool(
  "create_pull_request",
  "Create a new pull request",
  {
    title: z.string().describe("The pull request title"),
    body: z.string().optional().describe("The pull request body"),
    head: z.string().describe("The branch containing changes"),
    base: z.string().describe("The branch to merge into"),
  },
  async ({ title, body, head, base }) => {
    try {
      const pr = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
        "POST",
        { title, body, head, base },
      );

      return {
        content: [
          {
            type: "text",
            text: `Pull request created successfully: ${JSON.stringify(pr, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error creating pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error creating pull request: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Update pull request
server.tool(
  "update_pull_request",
  "Update an existing pull request",
  {
    pr_number: z.number().describe("The pull request number"),
    title: z.string().optional().describe("New title"),
    body: z.string().optional().describe("New body"),
    state: z.enum(["open", "closed"]).optional().describe("New state"),
  },
  async ({ pr_number, title, body, state }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (body !== undefined) updateData.body = body;
      if (state !== undefined) updateData.state = state;

      const pr = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr_number}`,
        "PATCH",
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: `Pull request updated successfully: ${JSON.stringify(pr, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error updating pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error updating pull request: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Merge pull request
server.tool(
  "merge_pull_request",
  "Merge a pull request",
  {
    pr_number: z.number().describe("The pull request number to merge"),
    merge_style: z
      .enum(["merge", "rebase", "squash"])
      .optional()
      .describe("Merge method"),
    merge_commit_message: z
      .string()
      .optional()
      .describe("Custom merge commit message"),
  },
  async ({ pr_number, merge_style, merge_commit_message }) => {
    try {
      const mergeData: Record<string, unknown> = {
        Do: merge_style || "merge",
      };
      if (merge_commit_message) {
        mergeData.MergeCommitMessage = merge_commit_message;
      }

      const result = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pr_number}/merge`,
        "POST",
        mergeData,
      );

      return {
        content: [
          {
            type: "text",
            text: `Pull request merged successfully: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error merging pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error merging pull request: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Get branch details
server.tool(
  "get_branch",
  "Get details of a specific branch",
  {
    branch: z.string().describe("The branch name"),
  },
  async ({ branch }) => {
    try {
      const branchInfo = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/branches/${encodeURIComponent(branch)}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(branchInfo, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting branch: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting branch: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Delete file
server.tool(
  "delete_file",
  "Delete a file from the repository",
  {
    path: z.string().describe("The file path to delete"),
    message: z.string().describe("Commit message"),
    sha: z.string().describe("SHA of the file being deleted"),
    branch: z.string().optional().describe("Branch to delete from"),
  },
  async ({ path, message, sha, branch }) => {
    try {
      const deleteData: Record<string, unknown> = {
        message,
        sha,
      };
      if (branch) {
        deleteData.branch = branch;
      }

      const result = await giteaRequest(
        `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
        "DELETE",
        deleteData,
      );

      return {
        content: [
          {
            type: "text",
            text: `File deleted successfully: ${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error deleting file: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error deleting file: ${errorMessage}`,
          },
        ],
      };
    }
  },
);

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.log("[GITEA-MCP] Gitea API Operations MCP Server started");
