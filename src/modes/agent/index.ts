import type { Mode } from "../types";

/**
 * Agent mode implementation.
 *
 * This mode is designed for automation and workflow_dispatch scenarios.
 * It always triggers (no checking), allows highly flexible configurations,
 * and works well with override_prompt for custom workflows.
 *
 * In the future, this mode could restrict certain tools for safety in automation contexts,
 * e.g., disallowing WebSearch or limiting file system operations.
 */
export const agentMode: Mode = {
  name: "agent",
  description: "Automation mode that always runs without trigger checking",

  shouldTrigger() {
    return true;
  },

  prepareContext(context, data) {
    return {
      mode: "agent",
      githubContext: context,
      commentId: data?.commentId,
      baseBranch: data?.baseBranch,
      claudeBranch: data?.claudeBranch,
    };
  },

  getAllowedTools() {
    // Agent mode runs in trusted automation contexts (webhook-dispatched
    // by an already-authorised bot). The base allowlist is intentionally
    // narrow — it only permits a handful of git subcommands via Bash —
    // which means agent runs cannot run `bun lint`, `pnpm test`, etc.
    // Without this, even with `permissionMode: auto` the agent gets
    // blocked at the CLI's --allowedTools layer, which is enforced
    // *before* the auto-mode safety classifier ever sees the call.
    //
    // We grant generic `Bash` here and let auto mode's classifier
    // gate per-call risk (scope escalation, prompt injection, untrusted
    // infra checks). Anyone using agent mode without auto mode should
    // pass `disallowed_tools` to lock things back down.
    return ["Bash"];
  },

  getDisallowedTools() {
    return [];
  },

  shouldCreateTrackingComment() {
    return false;
  },
};
