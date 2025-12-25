# HumanLayer Command Syncer — PRD.md  
**Version:** 0.6  
**Author:** Francis de Guzman  
**Status:** Draft  
**Source of Truth:** https://github.com/humanlayer/humanlayer

---

## 1. Overview

HumanLayer Command Syncer is a VS Code extension that automatically fetches, installs, and updates HumanLayer’s Claude Code command packs directly from the official HumanLayer repository. It enables developers to use HumanLayer’s multi‑agent workflows, slash commands, and prompt templates inside Claude Code without manual cloning, copying, or YAML management.

The extension installs commands at the **workspace level**, ensuring project‑specific workflows while keeping repositories clean by **preventing these generated files from being committed**. Installed commands are treated as **dependencies**, not source code, and are automatically added to `.gitignore` unless the user opts out.

This extension focuses **exclusively on `.claude/commands/`** for the MVP.

---

## 2. Problem Statement

HumanLayer publishes a rich set of prompts and slash commands inside its `.claude/commands/` directory. However:

- Users must manually clone or browse the repo  
- Commands must be manually copied into Claude’s custom command directories  
- Updates require manual pull + copy  
- No UI exists for browsing or selecting HumanLayer commands  
- Teams cannot standardize or sync HumanLayer commands easily  
- Workspace commands often get accidentally committed to Git repos  

This friction slows adoption and makes HumanLayer workflows harder to share and maintain.

---

## 3. Goals & Non‑Goals

### Goals
- Fetch HumanLayer commands directly from GitHub  
- Install commands **into the workspace** under `.claude/commands/humanlayer/`  
- Treat installed commands as **dependencies**, not source code  
- Automatically add installed commands to `.gitignore`  
- Provide a UI to browse, enable, disable, and update HumanLayer commands  
- Validate YAML before installation  
- Support version pinning to **tags**  
- Maintain a per‑folder lockfile  
- Support offline mode using cached commands  
- Provide a CLI for install/update/diff  
- Support HumanLayer‑defined profiles (minimal, full, custom)  
- Use VS Code’s built‑in diff viewer for updates  
- Rename files to disable commands  
- Support multi‑root workspaces (install into each folder containing `.claude/`)  

### Non‑Goals
- Do not fetch `.claude/agents/` or `.claude/hooks/` (post‑MVP)  
- Do not modify HumanLayer’s prompts  
- Do not override Claude Code’s built‑in commands  
- Do not sync commands across machines  
- Do not support arbitrary third‑party repos (future enhancement)

---

## 4. Source Repository Details

**Repository:** https://github.com/humanlayer/humanlayer

**Relevant directories for MVP:**
- `.claude/commands/`  
- `CLAUDE.md`  
- `test-slash-commands.md`  

Agents and hooks are intentionally excluded.

---

## 5. Core Features

### 5.1 GitHub Integration
- Fetch `.claude/commands/` from the HumanLayer repo  
- Support tags (default), branches, and specific commits  
- Cache metadata for offline mode  
- Support authenticated access in future versions  

### 5.2 Workspace‑Level Command Installation
- Install commands into:  
  ```
  <workspace>/.claude/commands/humanlayer/
  ```
- Automatically create `.claude/commands/` if missing  
- Automatically add to `.gitignore`  
- Never modify user‑authored commands  
- Install into **every folder** in a multi‑root workspace that contains a `.claude/` directory  

### 5.3 Command Pack Browser (Webview)
- List available HumanLayer commands  
- Show descriptions and previews  
- Enable/disable toggles (via file renaming)  
- Update indicators  
- Install/update buttons  
- Version selector (tag dropdown)  
- Profile selector (minimal / full / custom)  

### 5.4 YAML Validation
- Validate schema  
- Detect duplicate command names  
- Detect missing fields  
- Warn on conflicts with existing workspace commands  
- Treat user‑modified commands as “user‑modified” and exclude from updates  

### 5.5 Update System
- Check GitHub for new tags  
- Notify user when updates are available  
- Use VS Code’s built‑in diff viewer  
- Update only changed commands (partial updates)  
- Show command‑level diffs  
- Show tag‑level changelog (command diffs only)  
- Support rollback via version selector  

### 5.6 Lockfile
Stored at:
```
.claude/commands/humanlayer.lock.json
```

Contains:
```json
{
  "tag": "v1.2.0",
  "profile": "minimal",
  "commands": [
    { "name": "summarize", "path": "...", "hash": "..." }
  ],
  "timestamp": "..."
}
```

Lockfile is **not committed** to Git.

### 5.7 Offline Mode
- Use cached commands when GitHub is unavailable  
- Warn user when falling back to cache  
- Allow user to retry or proceed  

### 5.8 CLI Support
Minimal + script‑friendly:
```
code --humanlayer install --tag v1.2.0
code --humanlayer update
code --humanlayer diff
code --humanlayer profile minimal
```

Outputs JSON for automation.

### 5.9 Telemetry (Minimal)
- Errors only  
- No user identifiers  
- No usage tracking  

---

## 6. Architecture

### 6.1 Components
- **GitHub Fetcher** — retrieves command packs + metadata  
- **Command Installer** — writes workspace files + manages `.gitignore`  
- **YAML Validator** — schema + conflict detection  
- **UI Panel (Webview)** — browsing, enabling, updating  
- **Settings Manager** — tag, profile, auto‑update  
- **File Watcher** — detects local changes or conflicts  
- **Lockfile Manager** — ensures reproducibility  
- **CLI Handler** — install/update/diff  

---

## 7. User Flows

### 7.1 First‑Time Install
1. User opens “HumanLayer Commands” panel  
2. Selects tag + profile  
3. Clicks “Install from GitHub”  
4. Extension fetches `.claude/commands/`  
5. Validates YAML  
6. Installs into workspace  
7. Creates `.claude/commands/` if missing  
8. Adds to `.gitignore`  
9. Writes lockfile  
10. Claude Code auto‑detects new commands  

### 7.2 Update Flow
1. Extension checks GitHub for new tags  
2. Shows “Update available”  
3. User clicks “Update”  
4. Built‑in diff viewer opens  
5. User confirms  
6. Only changed commands are updated  
7. Lockfile updated  

### 7.3 Workspace Sync
- For multi‑root workspaces, install into each folder containing `.claude/`  
- Each folder maintains its own lockfile and settings  

### 7.4 Offline Mode
- If GitHub unreachable, extension offers:  
  - Retry  
  - Use cached version  
  - Cancel  

---

## 8. Configuration Options
- Install location (workspace only for MVP)  
- GitHub tag selector  
- Profile selector  
- Auto‑update toggle  
- Enable/disable specific commands  
- Auto‑add to `.gitignore` (on/off)  
- Offline mode behavior  

---

## 9. Testing Requirements
- GitHub API mock tests  
- YAML schema validation tests  
- Conflict detection tests  
- Workspace vs multi‑root install tests  
- `.gitignore` modification tests  
- UI interaction tests  
- Update flow tests  
- Lockfile integrity tests  
- Offline mode tests  
- CLI tests  

---

## 10. Future Enhancements
- Support syncing `.claude/agents/` and `.claude/hooks/`  
- Command editor with syntax highlighting  
- Team sync via GitHub org repos  
- Marketplace for Claude command packs  
- Integration with future Claude Code APIs  
- Export/import HumanLayer configuration  
- Support for private forks  

---

## 11. Milestones

| Milestone | Deliverable | ETA |
|----------|-------------|-----|
| M1 | GitHub fetcher + workspace installer + `.gitignore` handling | 1–2 weeks |
| M2 | UI panel + command browser + version/profile selector | 2–3 weeks |
| M3 | YAML validation + conflict handling + lockfile | 1 week |
| M4 | Update system + diff viewer + offline mode | 1 week |
| M5 | CLI + multi‑root support | 1 week |
| M6 | Beta release | — |

---

## 12. Publishing & Distribution

### 12.1 Prerequisites
- Microsoft Publisher ID  
- `vsce` installed  
- Personal Access Token  
- Valid `package.json`  

### 12.2 Packaging
```
vsce package
```
Produces:  
`humanlayer-command-syncer-x.y.z.vsix`

### 12.3 Publishing
```
vsce publish
vsce publish 0.1.0
```

### 12.4 Versioning
Semantic versioning:
- Patch = fixes  
- Minor = new features  
- Major = breaking changes  

### 12.5 Marketplace Listing Requirements
- README with screenshots  
- LICENSE  
- 128×128 icon  
- Tags: claude, humanlayer, commands, ai-tools, workflow  

### 12.6 Testing Before Publishing
- Extension activates  
- GitHub fetcher works  
- Commands install correctly  
- YAML validation passes  
- UI panel loads  
- No console errors  

### 12.7 Post‑Publish Maintenance
- Monitor analytics  
- Respond to issues  
- Publish updates as HumanLayer evolves  
- Maintain compatibility with Claude Code  
- Tag GitHub releases to match Marketplace versions  
```

---

