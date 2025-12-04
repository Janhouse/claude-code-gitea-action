import fs from "fs/promises";
import path from "path";
import type { Octokits } from "../api/client";
import { getServerUrl, isGiteaInstance } from "../api/config";

// Create image regex based on the current platform
function createImageRegex(): RegExp {
  const serverUrl = getServerUrl();

  // For Gitea, we might not have the same user-attachments structure
  // This is a placeholder that can be adjusted based on Gitea's image handling
  if (isGiteaInstance()) {
    // Gitea might use different paths for attachments
    return new RegExp(
      `!\\[[^\\]]*\\]\\((${serverUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/attachments\\/[^)]+)\\)`,
      "g",
    );
  }

  // GitHub format
  return new RegExp(
    `!\\[[^\\]]*\\]\\((${serverUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/user-attachments\\/assets\\/[^)]+)\\)`,
    "g",
  );
}

const IMAGE_REGEX = createImageRegex();

type IssueComment = {
  type: "issue_comment";
  id: string;
  body: string;
};

type ReviewComment = {
  type: "review_comment";
  id: string;
  body: string;
};

type ReviewBody = {
  type: "review_body";
  id: string;
  pullNumber: string;
  body: string;
};

type IssueBody = {
  type: "issue_body";
  issueNumber: string;
  body: string;
};

type PullRequestBody = {
  type: "pr_body";
  pullNumber: string;
  body: string;
};

export type CommentWithImages =
  | IssueComment
  | ReviewComment
  | ReviewBody
  | IssueBody
  | PullRequestBody;

export async function downloadCommentImages(
  octokits: Octokits,
  owner: string,
  repo: string,
  comments: CommentWithImages[],
): Promise<Map<string, string>> {
  const urlToPathMap = new Map<string, string>();
  const downloadsDir = "/tmp/github-images";

  await fs.mkdir(downloadsDir, { recursive: true });

  const commentsWithImages: Array<{
    comment: CommentWithImages;
    urls: string[];
  }> = [];

  for (const comment of comments) {
    const imageMatches = [...comment.body.matchAll(IMAGE_REGEX)];
    const urls = imageMatches.map((match) => match[1] as string);

    if (urls.length > 0) {
      commentsWithImages.push({ comment, urls });
      const id =
        comment.type === "issue_body"
          ? comment.issueNumber
          : comment.type === "pr_body"
            ? comment.pullNumber
            : comment.id;
      console.log(`Found ${urls.length} image(s) in ${comment.type} ${id}`);
    }
  }

  // Process each comment with images
  for (const { comment, urls } of commentsWithImages) {
    try {
      let bodyHtml: string | undefined;

      // Get the HTML version based on comment type
      switch (comment.type) {
        case "issue_comment": {
          const response = await octokits.rest.issues.getComment({
            owner,
            repo,
            comment_id: parseInt(comment.id),
            mediaType: {
              format: "full+json",
            },
          });
          bodyHtml = response.data.body_html;
          break;
        }
        case "review_comment": {
          try {
            const response = await octokits.rest.pulls.getReviewComment({
              owner,
              repo,
              comment_id: parseInt(comment.id),
              mediaType: {
                format: "full+json",
              },
            });
            bodyHtml = response.data.body_html;
          } catch (error) {
            console.warn(
              "Review comments not supported, using markdown body:",
              error,
            );
            // Fall back to markdown for Gitea compatibility
            bodyHtml = undefined;
          }
          break;
        }
        case "review_body": {
          try {
            const response = await octokits.rest.pulls.getReview({
              owner,
              repo,
              pull_number: parseInt(comment.pullNumber),
              review_id: parseInt(comment.id),
              mediaType: {
                format: "full+json",
              },
            });
            bodyHtml = response.data.body_html;
          } catch (error) {
            console.warn(
              "Review bodies not supported, using markdown body:",
              error,
            );
            // Fall back to markdown for Gitea compatibility
            bodyHtml = undefined;
          }
          break;
        }
        case "issue_body": {
          const response = await octokits.rest.issues.get({
            owner,
            repo,
            issue_number: parseInt(comment.issueNumber),
            mediaType: {
              format: "full+json",
            },
          });
          bodyHtml = response.data.body_html;
          break;
        }
        case "pr_body": {
          const response = await octokits.rest.pulls.get({
            owner,
            repo,
            pull_number: parseInt(comment.pullNumber),
            mediaType: {
              format: "full+json",
            },
          });
          // Type here seems to be wrong
          bodyHtml = (response.data as any).body_html;
          break;
        }
      }
      if (!bodyHtml) {
        const id =
          comment.type === "issue_body"
            ? comment.issueNumber
            : comment.type === "pr_body"
              ? comment.pullNumber
              : comment.id;
        console.warn(`No HTML body found for ${comment.type} ${id}`);
        continue;
      }

      // Extract signed URLs from HTML
      const signedUrlRegex =
        /https:\/\/private-user-images\.githubusercontent\.com\/[^"]+\?jwt=[^"]+/g;
      const signedUrls = bodyHtml.match(signedUrlRegex) || [];

      // Download each image
      for (let i = 0; i < Math.min(signedUrls.length, urls.length); i++) {
        const signedUrl = signedUrls[i];
        const originalUrl = urls[i];

        if (!signedUrl || !originalUrl) {
          continue;
        }

        // Check if we've already downloaded this URL
        if (urlToPathMap.has(originalUrl)) {
          continue;
        }

        const fileExtension = getImageExtension(originalUrl);
        const filename = `image-${Date.now()}-${i}${fileExtension}`;
        const localPath = path.join(downloadsDir, filename);

        try {
          console.log(`Downloading ${originalUrl}...`);

          const imageResponse = await fetch(signedUrl);
          if (!imageResponse.ok) {
            throw new Error(
              `HTTP ${imageResponse.status}: ${imageResponse.statusText}`,
            );
          }

          const arrayBuffer = await imageResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          await fs.writeFile(localPath, buffer);
          console.log(`✓ Saved: ${localPath}`);

          urlToPathMap.set(originalUrl, localPath);
        } catch (error) {
          console.error(`✗ Failed to download ${originalUrl}:`, error);
        }
      }
    } catch (error) {
      const id =
        comment.type === "issue_body"
          ? comment.issueNumber
          : comment.type === "pr_body"
            ? comment.pullNumber
            : comment.id;
      console.error(
        `Failed to process images for ${comment.type} ${id}:`,
        error,
      );
    }
  }

  return urlToPathMap;
}

function getImageExtension(url: string): string {
  const urlParts = url.split("/");
  const filename = urlParts[urlParts.length - 1];
  if (!filename) {
    throw new Error("Invalid URL: No filename found");
  }

  const match = filename.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i);
  return match ? match[0] : ".png";
}
