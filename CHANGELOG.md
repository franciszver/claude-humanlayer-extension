# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- User-level (global) installation support - install commands to `~/.claude/commands/humanlayer/` for use across all workspaces
- New configuration option `humanlayer.installLocation` to choose between workspace and user-level installation
- Support for installing commands without requiring an open workspace (when using user-level installation)

### Changed
- Installation messages now indicate whether commands were installed to workspace or user level
- Gitignore management now only applies to workspace installations

## [0.1.0] - 2024-12-24

### Added
- Initial release
- GitHub integration to fetch HumanLayer command packs
- Workspace-level command installation
- YAML validation with schema checking
- Lockfile management for reproducible installs
- Webview UI for browsing and managing commands
- Version/tag selection
- Profile support (minimal, full, custom)
- Automatic .gitignore management
- Update detection and notification
- Diff viewer integration for safe updates
- Offline mode with cached commands
- Multi-root workspace support
- Enable/disable individual commands
