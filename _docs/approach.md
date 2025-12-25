# Approach: HumanLayer Command Syncer  
**Version:** 0.1  
**Author:** Francis de Guzman  
**Purpose:** Define the phased development plan for implementing the HumanLayer Command Syncer extension, starting with core functionality and expanding toward full PRD coverage.

---

## Phase 1 — Core Foundation (MVP Engine)
**Goal:** Build the minimal functional pipeline: fetch → validate → install → ignore.

### 1.1 Extension Scaffolding
- Create VS Code extension structure  
- Define activation events  
- Register core commands (install, update, open panel)

### 1.2 GitHub Fetcher (Tags Only)
- Fetch `.claude/commands/` from HumanLayer repo  
- Support tag selection  
- Cache metadata for offline use  
- Basic error handling

### 1.3 Workspace Installer
- Detect `.claude/` directory  
- Create `.claude/commands/` if missing  
- Install HumanLayer commands into `humanlayer/` subfolder  
- Automatically add to `.gitignore`  
- Multi-root: install into each folder containing `.claude/`

### 1.4 YAML Validation
- Validate schema  
- Detect missing fields  
- Detect duplicate command names  
- Basic conflict detection

### 1.5 Lockfile (Minimal)
- Write lockfile to `.claude/commands/humanlayer.lock.json`  
- Store tag, timestamp, and command list  
- Exclude lockfile from Git

**Deliverable:**  
A working command syncer that installs HumanLayer commands into a workspace safely and reproducibly.

---

## Phase 2 — UI & Interaction Layer
**Goal:** Provide a usable interface for browsing, installing, and updating commands.

### 2.1 Webview Panel
- Command list  
- Command previews  
- Install/update buttons  
- Status indicators (installed, modified, disabled)

### 2.2 Version Selector
- Dropdown for tags  
- Show currently installed version  
- Show available updates

### 2.3 Profile Selector
- HumanLayer-defined profiles (minimal, full, custom)  
- Enforce profile purity (no overrides)

### 2.4 Notifications
- Toast on successful install/update  
- Warnings for conflicts or missing `.claude/`

**Deliverable:**  
A polished UI that makes the extension usable without touching the command palette.

---

## Phase 3 — Update System & Diffing
**Goal:** Make updates safe, transparent, and user-controlled.

### 3.1 Update Detection
- Compare installed tag vs latest tag  
- Notify user of updates

### 3.2 Partial Updates
- Update only changed commands  
- Skip user-modified commands  
- Update lockfile accordingly

### 3.3 Diff Viewer Integration
- Use VS Code’s built-in diff viewer  
- Show command-level diffs  
- Show tag-level changelog (command diffs only)

### 3.4 Rollback Support
- Allow switching tags via version selector  
- Reinstall commands from previous tag

**Deliverable:**  
A safe, predictable update flow with full transparency.

---

## Phase 4 — Advanced Behavior & Offline Mode
**Goal:** Improve robustness and support real-world workflows.

### 4.1 Offline Mode
- Use cached commands when GitHub unavailable  
- Warn user and allow retry  
- Allow install from cache

### 4.2 User-Modified Command Handling
- Detect modified commands  
- Exclude from updates  
- Mark as “user-modified” in UI

### 4.3 Disable Command Support
- Rename files using `.disabled` suffix  
- Reflect disabled state in UI  
- Persist disabled state in lockfile

### 4.4 Multi-Root Enhancements
- Per-folder lockfiles  
- Per-folder profiles  
- Per-folder tag selection

**Deliverable:**  
A resilient extension that behaves correctly in offline, multi-root, and mixed-modification environments.

---

## Phase 5 — CLI & Automation
**Goal:** Provide scriptable, CI-friendly control.

### 5.1 CLI Commands
- `code --humanlayer install --tag vX.Y.Z`  
- `code --humanlayer update`  
- `code --humanlayer diff`  
- `code --humanlayer profile minimal`

### 5.2 JSON Output Mode
- Machine-readable output for CI  
- Exit codes for success/failure

### 5.3 Dry-Run Mode
- Validate YAML  
- Show diffs  
- No installation

**Deliverable:**  
A fully automatable extension suitable for enterprise workflows.

---

## Phase 6 — Polish, Hardening & Beta Release
**Goal:** Prepare for public release.

### 6.1 Error Handling & Edge Cases
- Network failures  
- Permission issues  
- Invalid YAML  
- Missing directories

### 6.2 Performance Improvements
- Cache optimization  
- Lazy loading in UI  
- Efficient diffing

### 6.3 Documentation
- README with screenshots  
- Marketplace listing  
- Usage examples  
- Troubleshooting guide

### 6.4 Beta Release
- Publish to Marketplace  
- Gather user feedback  
- Monitor minimal telemetry (errors only)

**Deliverable:**  
A stable, documented, Marketplace-ready extension.

---

## Phase 7 — Post-MVP Enhancements (Future)
**Goal:** Expand beyond commands.

### 7.1 Support for Agents & Hooks (Optional)
- Sync `.claude/agents/`  
- Sync `.claude/hooks/`  
- UI for agent/hook browsing  
- Validation rules

### 7.2 Private Repo Support
- GitHub authentication  
- Enterprise workflows

### 7.3 Export/Import Config
- Export HumanLayer setup  
- Import into another workspace

### 7.4 Team Sync
- GitHub org-level command packs  
- Shared profiles  
- Shared lockfiles

**Deliverable:**  
A full HumanLayer ecosystem integration.

---

## Summary Roadmap

| Phase | Focus | Outcome |
|-------|--------|----------|
| **1** | Core engine | Fetch → validate → install → ignore |
| **2** | UI | Webview, version/profile selectors |
| **3** | Updates | Diffing, partial updates, rollback |
| **4** | Advanced behavior | Offline mode, multi-root, disable/modify handling |
| **5** | CLI | Automation + CI support |
| **6** | Polish | Docs, error handling, beta release |
| **7** | Future | Agents, hooks, private repos, team sync |

---

If you want, I can also generate:

- a **tasks.md** with engineering tickets  
- a **folder structure** for the extension  
- a **package.json** scaffold  
- a **GitHub fetcher architecture diagram**  
- a **Webview UI wireframe**

Just tell me what direction you want to go next.