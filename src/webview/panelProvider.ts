import * as vscode from 'vscode';
import * as os from 'os';
import { GitHubFetcher } from '../github';
import { YamlValidator } from '../validator';
import { CommandInstaller } from '../installer';
import { LockfileManager } from '../lockfile';
import { CacheManager } from '../cache';
import type { WebviewToExtensionMessage, CommandInfo, PanelState } from './types';

export class CommandBrowserProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'humanlayer.commandBrowser';

    private _view?: vscode.WebviewView;
    private readonly _extensionUri: vscode.Uri;
    private readonly _fetcher: GitHubFetcher;
    private readonly _validator: YamlValidator;
    private readonly _installer: CommandInstaller;
    private readonly _lockfile: LockfileManager;
    private readonly _cache: CacheManager;
    private _currentInstallLocation: 'workspace' | 'user' | null = null;

    constructor(
        extensionUri: vscode.Uri,
        fetcher: GitHubFetcher,
        validator: YamlValidator,
        installer: CommandInstaller,
        lockfile: LockfileManager,
        cache: CacheManager
    ) {
        this._extensionUri = extensionUri;
        this._fetcher = fetcher;
        this._validator = validator;
        this._installer = installer;
        this._lockfile = lockfile;
        this._cache = cache;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message: WebviewToExtensionMessage) => {
                await this._handleMessage(message);
            }
        );

        // Refresh when view becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._refresh();
            }
        });
    }

    private async _handleMessage(message: WebviewToExtensionMessage): Promise<void> {
        switch (message.type) {
            case 'ready':
                await this._refresh();
                break;

            case 'fetchTags':
                await this._fetchTags();
                break;

            case 'fetchCommands':
                await this._fetchCommands(message.tag);
                break;

            case 'install':
                await this._installCommands(message.tag, message.profile);
                break;

            case 'update':
                await this._updateCommands();
                break;

            case 'uninstall':
                await this._uninstallCommands();
                break;

            case 'toggleCommand':
                await this._toggleCommand(message.name, message.enabled);
                break;

            case 'previewCommand':
                await this._previewCommand(message.name);
                break;

            case 'refresh':
                await this._refresh(true); // Force refresh from GitHub
                break;

            case 'clearCache':
                await this._cache.clearCache();
                this._sendMessage({ type: 'showSuccess', message: 'Cache cleared' });
                break;
        }
    }

    private async _refresh(forceRefresh = false): Promise<void> {
        this._sendMessage({ type: 'setLoading', isLoading: true });

        try {
            const isOnline = await this._fetcher.isOnline();

            // When offline, only show tags that have cached commands
            let tags;
            if (!isOnline) {
                const cachedTagNames = await this._cache.getCachedTagsList();
                tags = cachedTagNames.map(name => ({ name, commit: { sha: '', url: '' }, zipball_url: '', tarball_url: '' }));
            } else {
                tags = await this._fetcher.fetchTags(forceRefresh);
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

            let installedCommands: CommandInfo[] = [];
            let currentTag = '';
            let currentProfile = 'full';
            let installLocation: 'workspace' | 'user' | null = null;

            // Check workspace-level lockfile first
            if (workspaceFolder) {
                const lockfile = await this._lockfile.read(workspaceFolder.uri);
                if (lockfile) {
                    currentTag = lockfile.tag;
                    currentProfile = lockfile.profile;
                    installLocation = lockfile.location || 'workspace';

                    installedCommands = lockfile.commands.map(cmd => ({
                        name: cmd.name,
                        path: cmd.path,
                        installed: true,
                        enabled: !cmd.disabled,
                        modified: cmd.userModified || false,
                        hasUpdate: false
                    }));
                }
            }

            // If no workspace lockfile, check user-level lockfile
            if (installedCommands.length === 0) {
                const userLockfile = await this._lockfile.readUserLevel();
                if (userLockfile) {
                    currentTag = userLockfile.tag;
                    currentProfile = userLockfile.profile;
                    installLocation = 'user';

                    installedCommands = userLockfile.commands.map(cmd => ({
                        name: cmd.name,
                        path: cmd.path,
                        installed: true,
                        enabled: !cmd.disabled,
                        modified: cmd.userModified || false,
                        hasUpdate: false
                    }));
                }
            }

            // Store current install location for use in toggle/preview
            this._currentInstallLocation = installLocation;

            const state: Partial<PanelState> = {
                tags: tags.map(t => t.name),
                selectedTag: currentTag || tags[0]?.name || '',
                profile: currentProfile,
                commands: installedCommands,
                isLoading: false,
                isOffline: !isOnline,
                installLocation
            };

            this._sendMessage({ type: 'setState', state });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this._sendMessage({ type: 'showError', message });
            this._sendMessage({ type: 'setLoading', isLoading: false });
        }
    }

    private async _fetchTags(): Promise<void> {
        try {
            const tags = await this._fetcher.fetchTags();
            this._sendMessage({
                type: 'setState',
                state: { tags: tags.map(t => t.name) }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch tags';
            this._sendMessage({ type: 'showError', message });
        }
    }

    private async _fetchCommands(tag: string): Promise<void> {
        this._sendMessage({ type: 'setLoading', isLoading: true });

        try {
            const commands = await this._fetcher.fetchCommands(tag);
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

            // Check workspace lockfile first, then user-level
            let lockfile = workspaceFolder
                ? await this._lockfile.read(workspaceFolder.uri)
                : null;
            if (!lockfile) {
                lockfile = await this._lockfile.readUserLevel();
            }

            const commandInfos: CommandInfo[] = commands.map(cmd => {
                const lockedCmd = lockfile?.commands.find(c => c.name === cmd.name);
                return {
                    name: cmd.name,
                    path: cmd.path,
                    installed: !!lockedCmd,
                    enabled: lockedCmd ? !lockedCmd.disabled : true,
                    modified: lockedCmd?.userModified || false,
                    hasUpdate: false // Will be calculated separately
                };
            });

            this._sendMessage({
                type: 'setState',
                state: {
                    commands: commandInfos,
                    selectedTag: tag,
                    isLoading: false
                }
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch commands';
            this._sendMessage({ type: 'showError', message });
            this._sendMessage({ type: 'setLoading', isLoading: false });
        }
    }

    private async _installCommands(tag: string, profile: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('humanlayer');
        const installLocation = config.get<'workspace' | 'user'>('installLocation', 'workspace');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        // Check workspace requirement for workspace-level installation
        if (installLocation === 'workspace' && !workspaceFolder) {
            this._sendMessage({
                type: 'showError',
                message: 'No workspace folder open. Open a folder or change installation location to "user" in settings.'
            });
            return;
        }

        this._sendMessage({ type: 'setLoading', isLoading: true });

        try {
            const commands = await this._fetcher.fetchCommands(tag);
            const validation = this._validator.validateCommands(commands);

            if (validation.errors.length > 0) {
                const proceed = await vscode.window.showWarningMessage(
                    `Found ${validation.errors.length} validation error(s). Continue?`,
                    'Yes',
                    'No'
                );
                if (proceed !== 'Yes') {
                    this._sendMessage({ type: 'setLoading', isLoading: false });
                    return;
                }
            }

            const result = await this._installer.install(
                installLocation === 'user' ? undefined : workspaceFolder?.uri,
                commands,
                tag,
                profile,
                installLocation
            );

            if (result.success) {
                this._sendMessage({
                    type: 'showSuccess',
                    message: `Installed ${result.installedCount} commands`
                });
                await this._refresh();
            } else {
                this._sendMessage({
                    type: 'showError',
                    message: `Install failed: ${result.errors.join(', ')}`
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Install failed';
            this._sendMessage({ type: 'showError', message });
        }

        this._sendMessage({ type: 'setLoading', isLoading: false });
    }

    private async _updateCommands(): Promise<void> {
        vscode.commands.executeCommand('humanlayer.update');
    }

    private async _uninstallCommands(): Promise<void> {
        const location = this._currentInstallLocation;
        if (!location) {
            this._sendMessage({ type: 'showError', message: 'No commands installed' });
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Remove all HumanLayer commands from ${location === 'user' ? 'user level (~/.claude)' : 'workspace'}?`,
            { modal: true },
            'Remove'
        );

        if (confirm !== 'Remove') {
            return;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            await this._installer.uninstall(workspaceFolder?.uri, location);
            this._sendMessage({ type: 'showSuccess', message: 'Commands removed successfully' });
            await this._refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Uninstall failed';
            this._sendMessage({ type: 'showError', message });
        }
    }

    private async _toggleCommand(name: string, enabled: boolean): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const location = this._currentInstallLocation || 'workspace';

        try {
            await this._installer.toggleCommand(workspaceFolder?.uri, name, enabled, location);
            // Update lockfile at correct location
            if (location === 'user') {
                const homeUri = this._getUserHomeUri();
                await this._lockfile.markAsDisabled(homeUri, name, !enabled);
            } else if (workspaceFolder) {
                await this._lockfile.markAsDisabled(workspaceFolder.uri, name, !enabled);
            }
            await this._refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Toggle failed';
            this._sendMessage({ type: 'showError', message });
        }
    }

    private _getUserHomeUri(): vscode.Uri {
        return vscode.Uri.file(os.homedir());
    }

    private async _previewCommand(name: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const location = this._currentInstallLocation || 'workspace';

        // Determine base URI based on install location
        let baseUri: vscode.Uri;
        if (location === 'user') {
            baseUri = this._getUserHomeUri();
        } else if (workspaceFolder) {
            baseUri = workspaceFolder.uri;
        } else {
            return;
        }

        const extensions = ['.md', '.yaml', '.yml'];

        for (const ext of extensions) {
            const commandPath = vscode.Uri.joinPath(
                baseUri,
                '.claude/commands/humanlayer',
                `${name}${ext}`
            );

            try {
                const doc = await vscode.workspace.openTextDocument(commandPath);
                await vscode.window.showTextDocument(doc, { preview: true });
                return;
            } catch {
                // Try next extension
            }
        }

        this._sendMessage({
            type: 'showError',
            message: `Could not find command file: ${name}`
        });
    }

    private _sendMessage(message: { type: string; [key: string]: unknown }): void {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>HumanLayer Commands</title>
    <style>
        :root {
            --container-padding: 12px;
            --input-padding: 6px 8px;
            --button-padding: 6px 12px;
        }

        body {
            padding: 0;
            margin: 0;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
        }

        .container {
            padding: var(--container-padding);
        }

        .header {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        select, button {
            padding: var(--input-padding);
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: inherit;
        }

        select {
            flex: 1;
            min-width: 0;
        }

        button {
            padding: var(--button-padding);
            cursor: pointer;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .command-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .command-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: var(--vscode-list-inactiveSelectionBackground);
            border-radius: 4px;
            cursor: pointer;
        }

        .command-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .command-name {
            flex: 1;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .command-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            text-transform: uppercase;
        }

        .badge-installed {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }

        .badge-modified {
            background: var(--vscode-testing-iconQueued);
            color: white;
        }

        .badge-disabled {
            background: var(--vscode-disabledForeground);
            color: white;
        }

        .toggle {
            width: 36px;
            height: 20px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 10px;
            position: relative;
            cursor: pointer;
        }

        .toggle::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            background: var(--vscode-foreground);
            border-radius: 50%;
            top: 1px;
            left: 1px;
            transition: transform 0.2s;
        }

        .toggle.enabled {
            background: var(--vscode-button-background);
        }

        .toggle.enabled::after {
            transform: translateX(16px);
        }

        .status {
            padding: 8px;
            margin-bottom: 12px;
            border-radius: 4px;
            font-size: 12px;
        }

        .status.error {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }

        .status.success {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }

        .status.offline {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
        }

        .loading {
            display: flex;
            justify-content: center;
            padding: 20px;
        }

        .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid var(--vscode-foreground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }

        .label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }

        .hidden {
            display: none !important;
        }

        .install-location-banner {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            margin-bottom: 12px;
            border-radius: 4px;
            font-size: 12px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-editorWidget-border);
        }

        .install-location-banner.user-level {
            background: var(--vscode-inputValidation-infoBackground);
            border-color: var(--vscode-inputValidation-infoBorder);
        }

        .install-location-icon {
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div id="status" class="status hidden"></div>
        <div id="installLocationBanner" class="install-location-banner hidden"></div>

        <div class="header">
            <div>
                <div class="label">Version</div>
                <div class="row">
                    <select id="tagSelect" title="Select version">
                        <option value="">Loading...</option>
                    </select>
                    <button id="refreshBtn" class="secondary" title="Refresh">↻</button>
                </div>
            </div>

            <div>
                <div class="label">Profile</div>
                <div class="row">
                    <select id="profileSelect" title="Select profile">
                        <option value="minimal">Minimal</option>
                        <option value="full" selected>Full</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
            </div>

            <div class="row">
                <button id="installBtn" style="flex: 1;">Install</button>
                <button id="updateBtn" class="secondary">Update</button>
            </div>
            <div class="row">
                <button id="uninstallBtn" class="secondary" style="flex: 1;">Uninstall</button>
            </div>
        </div>

        <div id="loading" class="loading hidden">
            <div class="spinner"></div>
        </div>

        <div id="commandList" class="command-list"></div>

        <div id="emptyState" class="empty-state hidden">
            No commands installed. Select a version and click Install.
        </div>
    </div>

    <script nonce="${nonce}">
        (function() {
            const vscode = acquireVsCodeApi();

            // State
            let state = {
                tags: [],
                selectedTag: '',
                profile: 'full',
                commands: [],
                isLoading: false,
                isOffline: false,
                installLocation: null
            };

            // Elements
            const tagSelect = document.getElementById('tagSelect');
            const profileSelect = document.getElementById('profileSelect');
            const installBtn = document.getElementById('installBtn');
            const updateBtn = document.getElementById('updateBtn');
            const uninstallBtn = document.getElementById('uninstallBtn');
            const refreshBtn = document.getElementById('refreshBtn');
            const commandList = document.getElementById('commandList');
            const loading = document.getElementById('loading');
            const emptyState = document.getElementById('emptyState');
            const statusEl = document.getElementById('status');
            const installLocationBanner = document.getElementById('installLocationBanner');

            // Event listeners
            tagSelect.addEventListener('change', () => {
                state.selectedTag = tagSelect.value;
                vscode.postMessage({ type: 'fetchCommands', tag: state.selectedTag });
            });

            profileSelect.addEventListener('change', () => {
                state.profile = profileSelect.value;
            });

            installBtn.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'install',
                    tag: state.selectedTag,
                    profile: state.profile
                });
            });

            updateBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'update' });
            });

            uninstallBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'uninstall' });
            });

            refreshBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'refresh' });
            });

            // Message handler
            window.addEventListener('message', event => {
                const message = event.data;

                switch (message.type) {
                    case 'setState':
                        state = { ...state, ...message.state };
                        render();
                        break;

                    case 'setLoading':
                        state.isLoading = message.isLoading;
                        render();
                        break;

                    case 'showError':
                        showStatus(message.message, 'error');
                        break;

                    case 'showSuccess':
                        showStatus(message.message, 'success');
                        break;
                }
            });

            function showStatus(message, type) {
                statusEl.textContent = message;
                statusEl.className = 'status ' + type;
                statusEl.classList.remove('hidden');

                setTimeout(() => {
                    statusEl.classList.add('hidden');
                }, 5000);
            }

            function render() {
                // Loading state
                loading.classList.toggle('hidden', !state.isLoading);

                // Offline indicator
                if (state.isOffline) {
                    showStatus('Offline mode - using cached data', 'offline');
                }

                // Install location banner
                if (state.installLocation === 'user' && state.commands.length > 0) {
                    installLocationBanner.innerHTML = '<span class="install-location-icon">~</span> Commands installed at user level (~/.claude)';
                    installLocationBanner.className = 'install-location-banner user-level';
                } else if (state.installLocation === 'workspace' && state.commands.length > 0) {
                    installLocationBanner.innerHTML = '<span class="install-location-icon">.</span> Commands installed in workspace';
                    installLocationBanner.className = 'install-location-banner';
                } else {
                    installLocationBanner.className = 'install-location-banner hidden';
                }

                // Tags dropdown
                tagSelect.innerHTML = state.tags.length > 0
                    ? state.tags.map(tag =>
                        '<option value="' + tag + '"' + (tag === state.selectedTag ? ' selected' : '') + '>' + tag + '</option>'
                    ).join('')
                    : '<option value="">No tags available</option>';

                // Profile dropdown
                profileSelect.value = state.profile;

                // Commands list
                if (state.commands.length === 0 && !state.isLoading) {
                    emptyState.classList.remove('hidden');
                    commandList.innerHTML = '';
                } else {
                    emptyState.classList.add('hidden');
                    commandList.innerHTML = state.commands.map(cmd => {
                        let badges = '';
                        if (cmd.installed) {
                            badges += '<span class="command-badge badge-installed">Installed</span>';
                        }
                        if (cmd.modified) {
                            badges += '<span class="command-badge badge-modified">Modified</span>';
                        }
                        if (!cmd.enabled && cmd.installed) {
                            badges += '<span class="command-badge badge-disabled">Disabled</span>';
                        }

                        // Escape HTML to prevent XSS
                        const safeName = cmd.name.replace(/[&<>"']/g, c => ({
                            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                        })[c] || c);

                        return '<div class="command-item" data-name="' + safeName + '">' +
                            '<span class="command-name">' + safeName + '</span>' +
                            badges +
                            (cmd.installed ? '<div class="toggle ' + (cmd.enabled ? 'enabled' : '') + '" data-toggle="' + safeName + '"></div>' : '') +
                            '</div>';
                    }).join('');

                    // Add click handlers
                    commandList.querySelectorAll('.command-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            if (e.target.classList.contains('toggle')) {
                                return;
                            }
                            const name = item.dataset.name;
                            vscode.postMessage({ type: 'previewCommand', name });
                        });
                    });

                    commandList.querySelectorAll('.toggle').forEach(toggle => {
                        toggle.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const name = toggle.dataset.toggle;
                            const enabled = !toggle.classList.contains('enabled');
                            vscode.postMessage({ type: 'toggleCommand', name, enabled });
                        });
                    });
                }

                // Button states
                const hasInstalledCommands = state.commands.filter(c => c.installed).length > 0;
                installBtn.disabled = !state.selectedTag || state.isLoading;
                updateBtn.disabled = !hasInstalledCommands || state.isLoading;
                uninstallBtn.disabled = !hasInstalledCommands || state.isLoading;
            }

            // Initial render
            render();

            // Notify extension we're ready
            vscode.postMessage({ type: 'ready' });
        })();
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
