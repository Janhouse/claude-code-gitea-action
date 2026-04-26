import * as github from "@actions/github";
import * as fs from "node:fs";
import type {
  IssuesEvent,
  IssuesAssignedEvent,
  IssueCommentEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
} from "@octokit/webhooks-types";
import type { ModeName } from "../modes/types";
import { DEFAULT_MODE, isValidMode } from "../modes/registry";

export type ParsedGitHubContext = {
  runId: string;
  eventName: string;
  eventAction?: string;
  repository: {
    owner: string;
    repo: string;
    full_name: string;
  };
  actor: string;
  payload:
    | IssuesEvent
    | IssueCommentEvent
    | PullRequestEvent
    | PullRequestReviewEvent
    | PullRequestReviewCommentEvent;
  entityNumber: number;
  isPR: boolean;
  inputs: {
    mode: ModeName;
    triggerPhrase: string;
    assigneeTrigger: string;
    labelTrigger: string;
    allowedTools: string[];
    disallowedTools: string[];
    customInstructions: string;
    directPrompt: string;
    overridePrompt: string;
    baseBranch?: string;
    branchPrefix: string;
    useStickyComment: boolean;
    additionalPermissions: Map<string, string>;
    useCommitSigning: boolean;
  };
};

export function parseGitHubContext(): ParsedGitHubContext {
  const context = github.context;

  // Allow callers to inject a synthetic event payload + name. Useful when
  // invoking this action from a `workflow_dispatch` trigger (e.g. via a
  // webhook receiver like gitea-claude-bot) where the natural event the
  // action expects doesn't exist. Set CLAUDE_SYNTH_EVENT_PATH to a JSON
  // file with an issue/PR/comment-shaped payload, and
  // CLAUDE_SYNTH_EVENT_NAME to one of the supported event names below.
  //
  // We read into local vars (rather than mutating context) because
  // @actions/github's Context properties are readonly getters.
  let eventName = context.eventName;
  let payload: typeof context.payload = context.payload;
  let repoOwner = context.repo.owner;
  let repoName = context.repo.repo;
  let actor = context.actor;

  const synthPath = process.env.CLAUDE_SYNTH_EVENT_PATH;
  const synthName = process.env.CLAUDE_SYNTH_EVENT_NAME;
  if (synthPath && synthName) {
    const synth = JSON.parse(fs.readFileSync(synthPath, "utf8"));
    eventName = synthName;
    payload = synth;
    if (synth.repository) {
      repoOwner =
        synth.repository.owner?.login ?? synth.repository.owner ?? repoOwner;
      repoName = synth.repository.name ?? repoName;
    }
    if (synth.sender?.login) {
      actor = synth.sender.login;
    }
  }

  const modeInput = process.env.MODE ?? DEFAULT_MODE;
  if (!isValidMode(modeInput)) {
    throw new Error(`Invalid mode: ${modeInput}.`);
  }

  const commonFields = {
    runId: process.env.GITHUB_RUN_NUMBER!,
    eventName,
    eventAction: payload.action,
    repository: {
      owner: repoOwner,
      repo: repoName,
      full_name: `${repoOwner}/${repoName}`,
    },
    actor,
    inputs: {
      mode: modeInput as ModeName,
      triggerPhrase: process.env.TRIGGER_PHRASE ?? "@claude",
      assigneeTrigger: process.env.ASSIGNEE_TRIGGER ?? "",
      labelTrigger: process.env.LABEL_TRIGGER ?? "",
      allowedTools: parseMultilineInput(process.env.ALLOWED_TOOLS ?? ""),
      disallowedTools: parseMultilineInput(process.env.DISALLOWED_TOOLS ?? ""),
      customInstructions: process.env.CUSTOM_INSTRUCTIONS ?? "",
      directPrompt: process.env.DIRECT_PROMPT ?? "",
      overridePrompt: process.env.OVERRIDE_PROMPT ?? "",
      baseBranch: process.env.BASE_BRANCH,
      branchPrefix: process.env.BRANCH_PREFIX ?? "claude/",
      useStickyComment: process.env.USE_STICKY_COMMENT === "true",
      additionalPermissions: parseAdditionalPermissions(
        process.env.ADDITIONAL_PERMISSIONS ?? "",
      ),
      useCommitSigning: process.env.USE_COMMIT_SIGNING === "true",
    },
  };

  switch (eventName) {
    case "issues": {
      return {
        ...commonFields,
        payload: payload as IssuesEvent,
        entityNumber: (payload as IssuesEvent).issue.number,
        isPR: false,
      };
    }
    case "issue_comment": {
      return {
        ...commonFields,
        payload: payload as IssueCommentEvent,
        entityNumber: (payload as IssueCommentEvent).issue.number,
        isPR: Boolean((payload as IssueCommentEvent).issue.pull_request),
      };
    }
    case "pull_request": {
      return {
        ...commonFields,
        payload: payload as PullRequestEvent,
        entityNumber: (payload as PullRequestEvent).pull_request.number,
        isPR: true,
      };
    }
    case "pull_request_review": {
      return {
        ...commonFields,
        payload: payload as PullRequestReviewEvent,
        entityNumber: (payload as PullRequestReviewEvent).pull_request.number,
        isPR: true,
      };
    }
    case "pull_request_review_comment": {
      return {
        ...commonFields,
        payload: payload as PullRequestReviewCommentEvent,
        entityNumber: (payload as PullRequestReviewCommentEvent).pull_request
          .number,
        isPR: true,
      };
    }
    default:
      throw new Error(`Unsupported event type: ${eventName}`);
  }
}

export function parseMultilineInput(s: string): string[] {
  return s
    .split(/,|[\n\r]+/)
    .map((tool) => tool.replace(/#.+$/, ""))
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);
}

export function parseAdditionalPermissions(s: string): Map<string, string> {
  const permissions = new Map<string, string>();
  if (!s || !s.trim()) {
    return permissions;
  }

  const lines = s.trim().split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      const [key, value] = trimmedLine.split(":").map((part) => part.trim());
      if (key && value) {
        permissions.set(key, value);
      }
    }
  }
  return permissions;
}

export function isIssuesEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: IssuesEvent } {
  return context.eventName === "issues";
}

export function isIssueCommentEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: IssueCommentEvent } {
  return context.eventName === "issue_comment";
}

export function isPullRequestEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestEvent } {
  return context.eventName === "pull_request";
}

export function isPullRequestReviewEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestReviewEvent } {
  return context.eventName === "pull_request_review";
}

export function isPullRequestReviewCommentEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestReviewCommentEvent } {
  return context.eventName === "pull_request_review_comment";
}

export function isIssuesAssignedEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: IssuesAssignedEvent } {
  return isIssuesEvent(context) && context.eventAction === "assigned";
}
