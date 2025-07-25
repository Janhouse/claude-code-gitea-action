# Claude Code Action for Gitea

![Claude Code Action in action](assets/preview.png)

A Gitea action that provides a general-purpose [Claude Code](https://claude.ai/code) assistant for PRs and issues that can answer questions and implement code changes. It listens for a trigger phrase in comments and activates Claude to act on the request. Supports multiple authentication methods including Anthropic direct API, Amazon Bedrock, and Google Vertex AI.

> **Note**: This action is designed specifically for Gitea installations, using local git operations for optimal compatibility with Gitea's API capabilities.

## Features

- 🤖 **Interactive Code Assistant**: Claude can answer questions about code, architecture, and programming
- 🔍 **Code Review**: Analyzes PR changes and suggests improvements
- ✨ **Code Implementation**: Can implement simple fixes, refactoring, and even new features
- 💬 **PR/Issue Integration**: Works seamlessly with Gitea comments and PR reviews
- 🛠️ **Flexible Tool Access**: Access to Gitea APIs and file operations (additional tools can be enabled via configuration)
- 📋 **Progress Tracking**: Visual progress indicators with checkboxes that dynamically update as Claude completes tasks

## Setup

**Requirements**: You must be a repository admin to complete these steps.

1. Add `ANTHROPIC_API_KEY` or `CLAUDE_CREDENTIALS` to your repository secrets
2. Add `GITEA_TOKEN` to your repository secrets (a personal access token with repository read/write permissions)
3. Copy the workflow file from [`examples/gitea-claude.yml`](./examples/gitea-claude.yml) into your repository's `.gitea/workflows/`

## Usage

Add a workflow file to your repository (e.g., `.gitea/workflows/claude.yml`):

```yaml
name: Claude Assistant
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude-response:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: markwylde/claude-code-gitea-action@v1.0.5
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }} # if you want to use direct API
          claude_credentials: ${{ secrets.CLAUDE_CREDENTIALS }} # if you have a Claude Max subscription
          gitea_token: ${{ secrets.GITEA_TOKEN }} # could be another users token (specific Claude user?)
          claude_git_name: Claude # optional
          claude_git_email: claude@anthropic.com # optional
```

## Inputs

| Input                 | Description                                                                                                                  | Required | Default                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------- |
| `anthropic_api_key`   | Anthropic API key (required for direct API, not needed for Bedrock/Vertex). Set to 'use-oauth' when using claude_credentials | No\*     | -                      |
| `claude_credentials`  | Claude OAuth credentials JSON for Claude AI Max subscription authentication                                                  | No       | -                      |
| `direct_prompt`       | Direct prompt for Claude to execute automatically without needing a trigger (for automated workflows)                        | No       | -                      |
| `timeout_minutes`     | Timeout in minutes for execution                                                                                             | No       | `30`                   |
| `gitea_token`         | Gitea token for Claude to operate with. **Only include this if you're connecting a custom GitHub app of your own!**          | No       | -                      |
| `model`               | Model to use (provider-specific format required for Bedrock/Vertex)                                                          | No       | -                      |
| `anthropic_model`     | **DEPRECATED**: Use `model` instead. Kept for backward compatibility.                                                        | No       | -                      |
| `use_bedrock`         | Use Amazon Bedrock with OIDC authentication instead of direct Anthropic API                                                  | No       | `false`                |
| `use_vertex`          | Use Google Vertex AI with OIDC authentication instead of direct Anthropic API                                                | No       | `false`                |
| `allowed_tools`       | Additional tools for Claude to use (the base GitHub tools will always be included)                                           | No       | ""                     |
| `disallowed_tools`    | Tools that Claude should never use                                                                                           | No       | ""                     |
| `custom_instructions` | Additional custom instructions to include in the prompt for Claude                                                           | No       | ""                     |
| `assignee_trigger`    | The assignee username that triggers the action (e.g. @claude). Only used for issue assignment                                | No       | -                      |
| `trigger_phrase`      | The trigger phrase to look for in comments, issue/PR bodies, and issue titles                                                | No       | `@claude`              |
| `claude_git_name`     | Git user.name for commits made by Claude                                                                                     | No       | `Claude`               |
| `claude_git_email`    | Git user.email for commits made by Claude                                                                                    | No       | `claude@anthropic.com` |

\*Required when using direct Anthropic API (default and when not using Bedrock or Vertex)

> **Note**: This action is currently in beta. Features and APIs may change as we continue to improve the integration.

## Claude Max Authentication

This action supports authentication using Claude Max OAuth credentials. This allows users with Claude Max subscriptions to use their existing authentication.

### Setup

1. **Get OAuth Credentials**: Use Claude Code to generate OAuth credentials:

   ```
   /auth-setup
   ```

2. **Add Credentials to Repository**: Add the generated JSON credentials as a repository secret named `CLAUDE_CREDENTIALS`.

It should look like this:

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-xxx",
    "refreshToken": "sk-ant-xxx",
    "expiresAt": 1748707000000,
    "scopes": ["user:inference", "user:profile"]
  }
}
```

3. **Configure Workflow**: Set up your workflow to use OAuth authentication:

```yaml
- uses: markwylde/claude-code-gitea-action@v1.0.5
  with:
    anthropic_api_key: "use-oauth"
    claude_credentials: ${{ secrets.CLAUDE_CREDENTIALS }}
    gitea_token: ${{ secrets.GITEA_TOKEN }}
```

When `anthropic_api_key` is set to `'use-oauth'`, the action will use the OAuth credentials provided in `claude_credentials` instead of a direct API key.

## Gitea Configuration

This action has been enhanced to work with Gitea installations. The main differences from GitHub are:

1. **Local Git Operations**: Instead of using API-based file operations (which have limited support in Gitea), this action uses local git commands to create branches, commit files, and push changes.

2. **API URL Configuration**: You must specify your Gitea server URL using the `gitea_api_url` input.

### Gitea Setup Notes

- Use a Gitea personal access token "GITEA_TOKEN"
- The token needs repository read/write permissions
- Claude will use local git operations for file changes and branch creation
- Only PR creation and comment updates use the Gitea API

## Examples

### Ways to Tag @claude

These examples show how to interact with Claude using comments in PRs and issues. By default, Claude will be triggered anytime you mention `@claude`, but you can customize the exact trigger phrase using the `trigger_phrase` input in the workflow.

Claude will see the full PR context, including any comments.

#### Ask Questions

Add a comment to a PR or issue:

```
@claude What does this function do and how could we improve it?
```

Claude will analyze the code and provide a detailed explanation with suggestions.

#### Request Fixes

Ask Claude to implement specific changes:

```
@claude Can you add error handling to this function?
```

#### Code Review

Get a thorough review:

```
@claude Please review this PR and suggest improvements
```

Claude will analyze the changes and provide feedback.

#### Fix Bugs from Screenshots

Upload a screenshot of a bug and ask Claude to fix it:

```
@claude Here's a screenshot of a bug I'm seeing [upload screenshot]. Can you fix it?
```

Claude can see and analyze images, making it easy to fix visual bugs or UI issues.

### Custom Automations

These examples show how to configure Claude to act automatically based on Gitea events, without requiring manual @mentions.

#### Supported Gitea Events

This action supports the following Gitea events:

- `pull_request` - When PRs are opened or synchronized
- `issue_comment` - When comments are created on issues or PRs
- `pull_request_comment` - When comments are made on PR diffs
- `issues` - When issues are opened or assigned
- `pull_request_review` - When PR reviews are submitted
- `pull_request_review_comment` - When comments are made on PR reviews
- `repository_dispatch` - Custom events triggered via API (coming soon)
- `workflow_dispatch` - Manual workflow triggers (coming soon)

#### Automated Documentation Updates

Automatically update documentation when specific files change (see [`examples/claude-pr-path-specific.yml`](./examples/claude-pr-path-specific.yml)):

```yaml
on:
  pull_request:
    paths:
      - "src/api/**/*.ts"

steps:
  - uses: markwylde/claude-code-gitea-action@v1.0.5
    with:
      direct_prompt: |
        Update the API documentation in README.md to reflect
        the changes made to the API endpoints in this PR.
```

When API files are modified, Claude automatically updates your README with the latest endpoint documentation and pushes the changes back to the PR, keeping your docs in sync with your code.

#### Author-Specific Code Reviews

Automatically review PRs from specific authors or external contributors (see [`examples/claude-review-from-author.yml`](./examples/claude-review-from-author.yml)):

```yaml
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review-by-author:
    if: |
      github.event.pull_request.user.login == 'developer1' ||
      github.event.pull_request.user.login == 'external-contributor'
    steps:
      - uses: markwylde/claude-code-gitea-action@v1
        with:
          direct_prompt: |
            Please provide a thorough review of this pull request.
            Pay extra attention to coding standards, security practices,
            and test coverage since this is from an external contributor.
```

Perfect for automatically reviewing PRs from new team members, external contributors, or specific developers who need extra guidance.

## How It Works

1. **Trigger Detection**: Listens for comments containing the trigger phrase (default: `@claude`) or issue assignment to a specific user
2. **Context Gathering**: Analyzes the PR/issue, comments, code changes
3. **Smart Responses**: Either answers questions or implements changes
4. **Branch Management**: Creates new PRs for human authors, pushes directly for Claude's own PRs
5. **Communication**: Posts updates at every step to keep you informed

This action is built specifically for Gitea environments with local git operations support.

## Capabilities and Limitations

### What Claude Can Do

- **Respond in a Single Comment**: Claude operates by updating a single initial comment with progress and results
- **Answer Questions**: Analyze code and provide explanations
- **Implement Code Changes**: Make simple to moderate code changes based on requests
- **Prepare Pull Requests**: Creates commits on a branch and links back to a prefilled PR creation page
- **Perform Code Reviews**: Analyze PR changes and provide detailed feedback
- **Smart Branch Handling**:
  - When triggered on an **issue**: Always creates a new branch for the work
  - When triggered on an **open PR**: Always pushes directly to the existing PR branch
  - When triggered on a **closed PR**: Creates a new branch since the original is no longer active

### What Claude Cannot Do

- **Submit PR Reviews**: Claude cannot submit formal Gitea PR reviews
- **Approve PRs**: For security reasons, Claude cannot approve pull requests
- **Post Multiple Comments**: Claude only acts by updating its initial comment
- **Execute Commands Outside Its Context**: Claude only has access to the repository and PR/issue context it's triggered in
- **Run Arbitrary Bash Commands**: By default, Claude cannot execute Bash commands unless explicitly allowed using the `allowed_tools` configuration
- **View CI/CD Results**: Cannot access CI systems, test results, or build logs unless an additional tool or MCP server is configured
- **Perform Branch Operations**: Cannot merge branches, rebase, or perform other git operations beyond pushing commits

## Advanced Configuration

### Custom Tools

By default, Claude only has access to:

- File operations (reading, committing, editing files, read-only git commands)
- Comment management (creating/updating comments)
- Basic Gitea operations

Claude does **not** have access to execute arbitrary Bash commands by default. If you want Claude to run specific commands (e.g., npm install, npm test), you must explicitly allow them using the `allowed_tools` configuration:

**Note**: If your repository has a `.mcp.json` file in the root directory, Claude will automatically detect and use the MCP server tools defined there. However, these tools still need to be explicitly allowed via the `allowed_tools` configuration.

```yaml
- uses: markwylde/claude-code-gitea-action@v1
  with:
    allowed_tools: "Bash(npm install),Bash(npm run test),Edit,Replace,NotebookEditCell"
    disallowed_tools: "TaskOutput,KillTask"
    # ... other inputs
```

**Note**: The base Gitea tools are always included. Use `allowed_tools` to add additional tools (including specific Bash commands), and `disallowed_tools` to prevent specific tools from being used.

### Custom Model

Use a specific Claude model:

```yaml
- uses: markwylde/claude-code-gitea-action@v1
  with:
    # model: "claude-3-5-sonnet-20241022"  # Optional: specify a different model
    # ... other inputs
```

## Cloud Providers

You can authenticate with Claude using any of these three methods:

1. Direct Anthropic API (default)
2. Anthropic OAuth credentials (Claude Max subscription)

## Security

### Access Control

- **Repository Access**: The action can only be triggered by users with write access to the repository
- **No Bot Triggers**: Bots cannot trigger this action
- **Token Permissions**: The Gitea token is scoped specifically to the repository it's operating in
- **No Cross-Repository Access**: Each action invocation is limited to the repository where it was triggered
- **Limited Scope**: The token cannot access other repositories or perform actions beyond the configured permissions

### Gitea Token Permissions

The Gitea personal access token requires these permissions:

- **Pull Requests**: Read and write to create PRs and push changes
- **Issues**: Read and write to respond to issues
- **Contents**: Read and write to modify repository files
