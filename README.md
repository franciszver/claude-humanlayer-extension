# HumanLayer Command Syncer

A VS Code extension that automatically fetches, installs, and updates HumanLayer's Claude Code command packs directly from the official HumanLayer repository.

## Features

- **One-Click Install**: Fetch and install HumanLayer commands from GitHub with a single click
- **Automatic Updates**: Get notified when new command versions are available
- **Version Selection**: Pin to specific tags or use the latest release
- **Profile Support**: Choose between minimal, full, or custom command sets
- **Offline Mode**: Works offline using cached commands
- **Multi-Root Support**: Install commands into each workspace folder
- **Safe Updates**: Preview changes with VS Code's diff viewer before applying
- **Git-Friendly**: Automatically adds installed commands to `.gitignore`

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "HumanLayer Command Syncer"
4. Click Install

## Usage

### Installing Commands

1. Open the HumanLayer panel in the sidebar
2. Select a version from the dropdown
3. Choose a profile (minimal/full/custom)
4. Click "Install"

Commands are installed to `.claude/commands/humanlayer/` in your workspace.

### Updating Commands

1. The extension automatically checks for updates
2. When an update is available, a notification appears
3. Click "Update" to preview and apply changes

### Command Palette

- `HumanLayer: Install Commands` - Install or reinstall commands
- `HumanLayer: Update Commands` - Check and apply updates
- `HumanLayer: Open Command Browser` - Open the HumanLayer panel
- `HumanLayer: Check for Updates` - Manually check for updates

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `humanlayer.autoUpdate` | `false` | Automatically check for updates on startup |
| `humanlayer.defaultProfile` | `"full"` | Default profile (minimal/full/custom) |
| `humanlayer.autoAddGitignore` | `true` | Add installed commands to .gitignore |
| `humanlayer.defaultTag` | `"latest"` | Default version tag |

## How It Works

1. **Fetches** command packs from the HumanLayer GitHub repository
2. **Validates** YAML syntax and schema
3. **Installs** commands to your workspace's `.claude/commands/humanlayer/` directory
4. **Creates** a lockfile for reproducible installs
5. **Updates** `.gitignore` to keep your repo clean

## File Structure

After installation, your workspace will have:

```
.claude/
└── commands/
    └── humanlayer/
        ├── command1.md
        ├── command2.yaml
        └── humanlayer.lock.json
```

## Offline Mode

When GitHub is unavailable, the extension uses cached commands. A warning is shown, and you can:
- Retry the connection
- Use cached version
- Cancel the operation

## Requirements

- VS Code 1.85.0 or higher
- Internet connection (for initial install and updates)

## Development

### Prerequisites

- Node.js (v18 or later)
- VS Code 1.85.0 or higher

### Setup

```bash
npm install
npm run compile
```

### Running Locally

1. Open the project in VS Code
2. Press **F5** to launch the Extension Development Host
3. The extension will be active in the new VS Code window

Two debug configurations are available:
- **Run Extension** - Compiles first, then launches
- **Run Extension (No Build)** - Skips compilation (use with `npm run watch`)

### Watch Mode

For development with automatic recompilation:

```bash
npm run watch
```

Then press **F5** to launch. Use **Ctrl+Shift+F5** to restart after changes.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode for development |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run package` | Create .vsix package |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/franciszver/claude-humanlayer-extension).

## License

MIT

## Links

- [HumanLayer Command Packs Repository](https://github.com/humanlayer/humanlayer)
- [Report Issues](https://github.com/franciszver/claude-humanlayer-extension/issues)
