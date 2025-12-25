```markdown
# Architecture: HumanLayer Command Syncer  
**Version:** 0.1  
**Author:** Francis de Guzman  
**Purpose:** Provide a high‑level architectural overview of the HumanLayer Command Syncer extension, including information flow and user experience, expressed through Mermaid diagrams.

---

# 1. System Architecture (Information Flow)

```mermaid
flowchart TD

    %% User Actions
    U[User] -->|Triggers Install/Update| CMD[VS Code Command Palette]

    %% Command Palette to Extension Core
    CMD --> EXT[Extension Core]

    %% Extension Core Components
    subgraph CORE[Extension Core]
        GH[GitHub Fetcher]
        VAL[YAML Validator]
        INST[Command Installer]
        LOCK[Lockfile Manager]
        CACHE[Cache Manager]
        UI[Webview UI Controller]
        DIFF[Diff Viewer Integration]
        CLI[CLI Handler]
    end

    %% GitHub Interaction
    GH -->|Fetch tags, commands, metadata| API[(GitHub API)]
    API --> GH

    %% Cache Interaction
    GH -->|Store metadata & commands| CACHE
    CACHE -->|Offline fallback| GH

    %% Validation
    GH -->|Fetched Commands| VAL
    CACHE -->|Cached Commands| VAL

    %% Installation
    VAL -->|Validated Commands| INST
    INST -->|Write to workspace| FS[(Workspace File System)]
    INST -->|Add to .gitignore| FS

    %% Lockfile
    INST --> LOCK
    LOCK --> FS

    %% UI Interaction
    U -->|Opens Panel| UI
    UI -->|Select Tag/Profile| EXT
    EXT --> UI

    %% Diffing
    GH --> DIFF
    LOCK --> DIFF
    DIFF --> UI

    %% CLI
    U -->|Runs CLI| CLI
    CLI --> EXT
```

---

# 2. User Experience Flow (End‑to‑End)

```mermaid
sequenceDiagram
    participant User
    participant VSCode as VS Code
    participant Panel as HumanLayer Panel (Webview)
    participant Ext as Extension Core
    participant GitHub as GitHub API
    participant FS as Workspace FS

    User->>VSCode: Open Command Palette
    VSCode->>Ext: Activate Extension

    User->>Panel: Open "HumanLayer Commands"
    Panel->>Ext: Request available tags & profiles
    Ext->>GitHub: Fetch tags (or use cache)
    GitHub-->>Ext: Tag list
    Ext-->>Panel: Display tags & profiles

    User->>Panel: Select tag + profile
    User->>Panel: Click "Install"

    Panel->>Ext: Install request
    Ext->>GitHub: Fetch commands for tag
    GitHub-->>Ext: Command pack

    Ext->>Ext: Validate YAML
    Ext->>FS: Create .claude/commands/ if missing
    Ext->>FS: Install commands into humanlayer/
    Ext->>FS: Add to .gitignore
    Ext->>FS: Write lockfile

    Ext-->>Panel: Installation success
    Panel-->>User: Toast: "Installed HumanLayer vX.Y.Z"

    Note over User,Panel: Update Flow

    Ext->>GitHub: Check for new tags
    GitHub-->>Ext: New tag available
    Ext-->>Panel: Show "Update Available"

    User->>Panel: Click "Update"
    Panel->>Ext: Update request

    Ext->>GitHub: Fetch updated commands
    Ext->>Ext: Compare with lockfile
    Ext->>VSCode: Open diff viewer
    User->>VSCode: Review & confirm

    Ext->>FS: Apply partial updates
    Ext->>FS: Update lockfile

    Ext-->>Panel: Update complete
    Panel-->>User: Toast: "Updated to vX.Y.Z"
```

---

# 3. Component Overview Diagram

```mermaid
flowchart LR

    subgraph UI[User Interface Layer]
        PanelUI[Webview Panel]
        Toast[Notifications]
        DiffUI[VS Code Diff Viewer]
    end

    subgraph Core[Extension Core Layer]
        Fetcher[GitHub Fetcher]
        Validator[YAML Validator]
        Installer[Command Installer]
        LockMgr[Lockfile Manager]
        CacheMgr[Cache Manager]
        ProfileMgr[Profile Selector]
        CLIMgr[CLI Handler]
    end

    subgraph Infra[Infrastructure Layer]
        GitHubAPI[(GitHub API)]
        WorkspaceFS[(Workspace File System)]
        GitIgnore[(.gitignore)]
        Lockfile[(humanlayer.lock.json)]
    end

    PanelUI --> Core
    CLIMgr --> Core

    Fetcher --> GitHubAPI
    Fetcher --> CacheMgr
    CacheMgr --> Fetcher

    Fetcher --> Validator
    Validator --> Installer

    Installer --> WorkspaceFS
    Installer --> GitIgnore
    Installer --> LockMgr

    LockMgr --> Lockfile

    Core --> DiffUI
    Core --> Toast
```

---

# 4. Summary

This architecture captures:

- **Information flow** between GitHub, the extension core, the workspace, and the UI  
- **User experience flow** from installation to updates  
- **Component responsibilities** and how they interact  
- **Support for multi-root workspaces, offline mode, profiles, lockfiles, and diffing**  

It reflects the PRD, Approach, and Resources documents and provides a clear blueprint for implementation.

```

---

