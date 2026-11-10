// Metro config for the TruTicket monorepo.
// Lets the app import shared design tokens from packages/ui-tokens.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.resolve(workspaceRoot, "packages")];

module.exports = config;
