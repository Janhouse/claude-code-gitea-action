export const GITHUB_API_URL =
  process.env.GITEA_API_URL ||
  process.env.GITHUB_API_URL ||
  "https://api.github.com";
export const GITHUB_SERVER_URL =
  process.env.GITHUB_SERVER_URL || "https://github.com";

// For Gitea compatibility, use GITEA_SERVER_URL if provided, otherwise fall back to GITHUB_SERVER_URL
export const SERVER_URL =
  process.env.GITEA_SERVER_URL ||
  process.env.GITHUB_SERVER_URL ||
  "https://github.com";

// Helper function to get the appropriate server URL for the current platform
export function getServerUrl(): string {
  return SERVER_URL;
}

// Helper function to determine if we're using Gitea
export function isGiteaInstance(): boolean {
  return !!process.env.GITEA_API_URL;
}
