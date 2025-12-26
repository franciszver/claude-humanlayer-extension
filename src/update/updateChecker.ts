import * as vscode from 'vscode';
import { GitHubFetcher } from '../github';
import { LockfileManager } from '../lockfile';
import type { UpdateInfo } from './types';
import * as crypto from 'crypto';

export class UpdateChecker {
    private _fetcher: GitHubFetcher;
    private _lockfile: LockfileManager;
    private _statusBarItem: vscode.StatusBarItem;

    constructor(fetcher: GitHubFetcher, lockfile: LockfileManager) {
        this._fetcher = fetcher;
        this._lockfile = lockfile;

        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this._statusBarItem.command = 'humanlayer.update';
    }

    async checkForUpdates(workspaceUri: vscode.Uri): Promise<UpdateInfo | null> {
        const currentLockfile = await this._lockfile.read(workspaceUri);
        if (!currentLockfile) {
            return null;
        }

        try {
            const tags = await this._fetcher.fetchTags();
            if (tags.length === 0) {
                return null;
            }

            const latestTag = tags[0].name;
            if (latestTag === currentLockfile.tag) {
                this.hideStatusBarItem();
                return {
                    currentTag: currentLockfile.tag,
                    latestTag,
                    hasUpdate: false,
                    changedCommands: [],
                    addedCommands: [],
                    removedCommands: []
                };
            }

            // Fetch commands for the new tag
            const newCommands = await this._fetcher.fetchCommands(latestTag);

            // Compare with current lockfile
            const comparison = await this._lockfile.compareWithRemote(
                workspaceUri,
                newCommands.map(cmd => ({
                    name: cmd.name,
                    hash: this.hashContent(cmd.content)
                }))
            );

            const updateInfo: UpdateInfo = {
                currentTag: currentLockfile.tag,
                latestTag,
                hasUpdate: true,
                changedCommands: comparison.changed,
                addedCommands: comparison.added,
                removedCommands: comparison.removed
            };

            this.showStatusBarItem(updateInfo);
            return updateInfo;
        } catch {
            // Silently fail - update checks are non-critical
            return null;
        }
    }

    async checkAllWorkspaces(): Promise<Map<string, UpdateInfo>> {
        const results = new Map<string, UpdateInfo>();
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            return results;
        }

        for (const folder of workspaceFolders) {
            const updateInfo = await this.checkForUpdates(folder.uri);
            if (updateInfo) {
                results.set(folder.name, updateInfo);
            }
        }

        return results;
    }

    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    private showStatusBarItem(updateInfo: UpdateInfo): void {
        const totalChanges =
            updateInfo.changedCommands.length +
            updateInfo.addedCommands.length +
            updateInfo.removedCommands.length;

        this._statusBarItem.text = `$(cloud-download) HumanLayer: ${totalChanges} update${totalChanges !== 1 ? 's' : ''}`;
        this._statusBarItem.tooltip = `Update available: ${updateInfo.currentTag} → ${updateInfo.latestTag}\n` +
            `Changed: ${updateInfo.changedCommands.length}\n` +
            `Added: ${updateInfo.addedCommands.length}\n` +
            `Removed: ${updateInfo.removedCommands.length}`;
        this._statusBarItem.show();
    }

    private hideStatusBarItem(): void {
        this._statusBarItem.hide();
    }

    dispose(): void {
        this._statusBarItem.dispose();
    }
}
