# Resources for HumanLayer Command Syncer  
**Version:** 0.1  
**Author:** Francis de Guzman  
**Purpose:** Identify and explain all resources required to build, test, publish, and maintain the HumanLayer Command Syncer VS Code extension.

---

## 1. HumanLayer Repository (Source of Truth)
**URL:** https://github.com/humanlayer/humanlayer

### Why It’s Needed
- Provides the canonical `.claude/commands/` directory  
- Supplies metadata files (`CLAUDE.md`, test command references)  
- Required for fetching tags, commits, and release information  
- Used for diffing, updates, and lockfile generation  

### Used In
- Phase 1 (GitHub Fetcher)  
- Phase 3 (Update System)  
- Phase 4 (Offline Mode)  

---

## 2. GitHub API Access
**APIs Needed**
- Tags endpoint  
- Repo contents endpoint  
- Commit metadata  
- Optional: authenticated access for future private repo support  

### Why It’s Needed
- Fetching command packs  
- Checking for updates  
- Retrieving diffs  
- Supporting offline caching  

### Used In
- Phase 1 (Core Fetcher)  
- Phase 3 (Update Detection)  
- Phase 4 (Offline Mode)  

---

## 3. VS Code Extension API
**Key APIs**
- `vscode.workspace` (file system, multi-root support)  
- `vscode.window` (notifications, diff viewer)  
- `vscode.commands` (CLI integration)  
- `vscode.WebviewPanel` (UI panel)  
- `vscode.Uri` (resource handling)  

### Why It’s Needed
- Installing commands into workspace folders  
- Creating `.gitignore` entries  
- Rendering the command browser UI  
- Showing diffs using built-in viewer  
- Handling CLI commands  

### Used In
- Phase 1 (Installer)  
- Phase 2 (Webview UI)  
- Phase 3 (Diff Viewer)  
- Phase 5 (CLI)  

---

## 4. YAML Parsing & Validation Library
**Recommended:** `yaml`, `js-yaml`, or `yaml-language-server` components

### Why It’s Needed
- Parse HumanLayer command files  
- Validate schema  
- Detect missing fields  
- Detect duplicate command names  
- Identify user-modified commands  

### Used In
- Phase 1 (YAML Validation)  
- Phase 3 (Partial Updates)  
- Phase 4 (User-Modified Handling)  

---

## 5. Lockfile Management Utilities
**Format:** JSON  
**Location:** `.claude/commands/humanlayer.lock.json`

### Why It’s Needed
- Ensures reproducible installs  
- Stores tag, profile, command hashes  
- Supports rollback and partial updates  
- Enables offline mode  

### Used In
- Phase 1 (Initial Lockfile)  
- Phase 3 (Update System)  
- Phase 4 (Offline Mode)  

---

## 6. Local Cache Directory
**Location:**  
- VS Code global storage  
- Or extension-specific cache folder  

### Why It’s Needed
- Offline mode  
- Faster update checks  
- Avoid redundant GitHub calls  

### Used In
- Phase 1 (Caching Metadata)  
- Phase 4 (Offline Mode)  

---

## 7. Webview UI Framework (Optional)
**Options**
- Vanilla HTML/CSS/JS  
- Svelte  
- React (with esbuild or Vite)  

### Why It’s Needed
- Render command list  
- Show previews  
- Provide version/profile selectors  
- Display update indicators  

### Used In
- Phase 2 (UI Panel)  

---

## 8. Diffing Tools
**Primary:** VS Code built-in diff viewer  
**Optional:** `diff` libraries for pre-processing

### Why It’s Needed
- Show command-level diffs  
- Show tag-level diffs  
- Support partial updates  
- Provide safe update flow  

### Used In
- Phase 3 (Diff Viewer Integration)  

---

## 9. CLI Integration Support
**VS Code Requirements**
- `contributes.commands`  
- `activationEvents`  
- `process.argv` parsing  

### Why It’s Needed
- Scriptable installs  
- CI/CD automation  
- JSON output for tooling  

### Used In
- Phase 5 (CLI)  

---

## 10. Testing Frameworks
**Recommended**
- Jest or Vitest (unit tests)  
- Playwright (UI tests)  
- Nock or MSW (GitHub API mocks)  

### Why It’s Needed
- Validate GitHub fetcher  
- Validate YAML parser  
- Test multi-root behavior  
- Test update flow  
- Test offline mode  

### Used In
- All phases, especially Phase 1, 3, and 4  

---

## 11. Publishing & Distribution Tools
**Tools**
- `vsce` (VS Code Extension Manager)  
- Microsoft Publisher ID  
- Personal Access Token (PAT)  

### Why It’s Needed
- Packaging `.vsix` files  
- Publishing to Marketplace  
- Managing versioning  

### Used In
- Phase 6 (Beta Release)  

---

## 12. Documentation & Asset Resources
**Needed**
- README.md  
- Screenshots of UI  
- 128×128 icon  
- LICENSE file  

### Why It’s Needed
- Marketplace listing  
- User onboarding  
- Developer clarity  

### Used In
- Phase 6 (Polish & Release)  

---

## 13. Optional Future Resources (Post-MVP)
- GitHub OAuth for private repos  
- HumanLayer agent/hook schemas  
- Team sync infrastructure  
- Export/import tooling  

### Why It’s Needed
- Future expansion beyond commands  
- Enterprise workflows  
- Team-level reproducibility  

### Used In
- Phase 7 (Post-MVP Enhancements)  

---

## Summary Table

| Resource | Purpose | Phase |
|---------|---------|--------|
| HumanLayer repo | Source of commands | 1, 3, 4 |
| GitHub API | Fetch tags, diffs, metadata | 1, 3, 4 |
| VS Code API | FS, UI, diff, CLI | 1–6 |
| YAML parser | Validation + conflict detection | 1, 3, 4 |
| Lockfile | Reproducibility | 1, 3, 4 |
| Cache | Offline mode | 1, 4 |
| Webview framework | UI panel | 2 |
| Diff viewer | Safe updates | 3 |
| CLI support | Automation | 5 |
| Testing tools | Reliability | All |
| vsce + Publisher ID | Release | 6 |
| Documentation assets | Marketplace | 6 |
| Future: OAuth, agent schemas | Expansion | 7 |

---

If you want, I can also generate:

- **tasks.md** (engineering tickets)  
- **architecture.md** (system diagrams + module responsibilities)  
- **ui-spec.md** (Webview layout + interactions)  
- **folder-structure.md** (extension scaffolding)  

Just tell me which one you want next.