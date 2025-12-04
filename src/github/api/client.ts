import { Octokit } from "@octokit/rest";
import { graphql } from "@octokit/graphql";
import { GITHUB_API_URL } from "./config";
import { GiteaApiClient } from "./gitea-client";

export type Octokits = {
  rest: Octokit;
  graphql: typeof graphql;
};

export type GitPlatformClient = Octokits | GiteaApiClient;

export function createOctokit(token: string): Octokits {
  return {
    rest: new Octokit({
      auth: token,
      baseUrl: GITHUB_API_URL,
    }),
    graphql: graphql.defaults({
      baseUrl: GITHUB_API_URL,
      headers: {
        authorization: `token ${token}`,
      },
    }),
  };
}

export function createGitPlatformClient(
  token: string,
  giteaApiUrl?: string,
): GitPlatformClient {
  if (giteaApiUrl) {
    return new GiteaApiClient(token, giteaApiUrl);
  }
  return createOctokit(token);
}

export function isGiteaClient(
  client: GitPlatformClient,
): client is GiteaApiClient {
  return client instanceof GiteaApiClient;
}
