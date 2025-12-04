import { $ } from "bun";
import { homedir } from "os";
import { readFile, access, constants } from "fs/promises";

export async function setupClaudeCodeSettings(
  settingsInput?: string,
  homeDir?: string,
) {
  const home = homeDir ?? homedir();
  const settingsPath = `${home}/.claude/settings.json`;
  const cwd = process.cwd();

  console.log(`Setting up Claude settings at: ${settingsPath}`);
  console.log(`Current working directory: ${cwd}`);

  // Log project-level settings if they exist (Claude Code 2.x reads these natively)
  const projectSettingsPath = `${cwd}/.claude/settings.json`;
  const projectLocalSettingsPath = `${cwd}/.claude/settings.local.json`;

  try {
    await access(projectSettingsPath, constants.R_OK);
    const projectSettings = await readFile(projectSettingsPath, "utf-8");
    console.log(
      `Found project settings at ${projectSettingsPath}:`,
      projectSettings.substring(0, 500),
    );
  } catch {
    console.log(`No project settings found at ${projectSettingsPath}`);
  }

  try {
    await access(projectLocalSettingsPath, constants.R_OK);
    const projectLocalSettings = await readFile(
      projectLocalSettingsPath,
      "utf-8",
    );
    console.log(
      `Found project local settings at ${projectLocalSettingsPath}:`,
      projectLocalSettings.substring(0, 500),
    );
  } catch {
    console.log(
      `No project local settings found at ${projectLocalSettingsPath}`,
    );
  }

  // Ensure .claude directory exists
  console.log(`Creating .claude directory...`);
  await $`mkdir -p ${home}/.claude`.quiet();

  let settings: Record<string, unknown> = {};
  try {
    const existingSettings = await $`cat ${settingsPath}`.quiet().text();
    if (existingSettings.trim()) {
      settings = JSON.parse(existingSettings);
      console.log(
        `Found existing settings:`,
        JSON.stringify(settings, null, 2),
      );
    } else {
      console.log(`Settings file exists but is empty`);
    }
  } catch (e) {
    console.log(`No existing settings file found, creating new one`);
  }

  // Handle settings input (either file path or JSON string)
  if (settingsInput && settingsInput.trim()) {
    console.log(`Processing settings input...`);
    let inputSettings: Record<string, unknown> = {};

    try {
      // First try to parse as JSON
      inputSettings = JSON.parse(settingsInput);
      console.log(`Parsed settings input as JSON`);
    } catch (e) {
      // If not JSON, treat as file path
      console.log(
        `Settings input is not JSON, treating as file path: ${settingsInput}`,
      );
      try {
        const fileContent = await readFile(settingsInput, "utf-8");
        inputSettings = JSON.parse(fileContent);
        console.log(`Successfully read and parsed settings from file`);
      } catch (fileError) {
        console.error(`Failed to read or parse settings file: ${fileError}`);
        throw new Error(`Failed to process settings input: ${fileError}`);
      }
    }

    // Merge input settings with existing settings
    settings = { ...settings, ...inputSettings };
    console.log(`Merged settings with input settings`);
  }

  // Always set enableAllProjectMcpServers to true to ensure project MCP servers are loaded
  settings.enableAllProjectMcpServers = true;
  console.log(`Updated settings with enableAllProjectMcpServers: true`);

  await $`echo ${JSON.stringify(settings, null, 2)} > ${settingsPath}`.quiet();
  console.log(`Settings saved successfully`);
  console.log(
    `Note: Claude Code 2.x will also read project-level settings from ${cwd}/.claude/`,
  );
}
