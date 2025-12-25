import * as vscode from 'vscode';
import type { Lockfile, LockfileCommand } from './types';

const LOCKFILE_PATH = '.claude/commands/humanlayer.lock.json';

export class LockfileManager {
    async read(workspaceUri: vscode.Uri): Promise<Lockfile | null> {
        const lockfilePath = vscode.Uri.joinPath(workspaceUri, LOCKFILE_PATH);

        try {
            const bytes = await vscode.workspace.fs.readFile(lockfilePath);
            const content = Buffer.from(bytes).toString('utf-8');
            return JSON.parse(content) as Lockfile;
        } catch {
            return null;
        }
    }

    async write(workspaceUri: vscode.Uri, lockfile: Lockfile): Promise<void> {
        const lockfilePath = vscode.Uri.joinPath(workspaceUri, LOCKFILE_PATH);
        const content = JSON.stringify(lockfile, null, 2);

        await vscode.workspace.fs.writeFile(
            lockfilePath,
            Buffer.from(content, 'utf-8')
        );
    }

    async delete(workspaceUri: vscode.Uri): Promise<void> {
        const lockfilePath = vscode.Uri.joinPath(workspaceUri, LOCKFILE_PATH);

        try {
            await vscode.workspace.fs.delete(lockfilePath);
        } catch {
            // File may not exist
        }
    }

    async updateCommand(
        workspaceUri: vscode.Uri,
        commandName: string,
        updates: Partial<LockfileCommand>
    ): Promise<void> {
        const lockfile = await this.read(workspaceUri);
        if (!lockfile) {
            return;
        }

        const commandIndex = lockfile.commands.findIndex(c => c.name === commandName);
        if (commandIndex === -1) {
            return;
        }

        lockfile.commands[commandIndex] = {
            ...lockfile.commands[commandIndex],
            ...updates
        };

        await this.write(workspaceUri, lockfile);
    }

    async markAsModified(workspaceUri: vscode.Uri, commandName: string): Promise<void> {
        await this.updateCommand(workspaceUri, commandName, { userModified: true });
    }

    async markAsDisabled(workspaceUri: vscode.Uri, commandName: string, disabled: boolean): Promise<void> {
        await this.updateCommand(workspaceUri, commandName, { disabled });
    }

    async getModifiedCommands(workspaceUri: vscode.Uri): Promise<string[]> {
        const lockfile = await this.read(workspaceUri);
        if (!lockfile) {
            return [];
        }

        return lockfile.commands
            .filter(c => c.userModified)
            .map(c => c.name);
    }

    async getDisabledCommands(workspaceUri: vscode.Uri): Promise<string[]> {
        const lockfile = await this.read(workspaceUri);
        if (!lockfile) {
            return [];
        }

        return lockfile.commands
            .filter(c => c.disabled)
            .map(c => c.name);
    }

    async compareWithRemote(
        workspaceUri: vscode.Uri,
        remoteCommands: Array<{ name: string; hash: string }>
    ): Promise<{
        added: string[];
        removed: string[];
        changed: string[];
        unchanged: string[];
    }> {
        const lockfile = await this.read(workspaceUri);

        if (!lockfile) {
            return {
                added: remoteCommands.map(c => c.name),
                removed: [],
                changed: [],
                unchanged: []
            };
        }

        const localMap = new Map(lockfile.commands.map(c => [c.name, c.hash]));
        const remoteMap = new Map(remoteCommands.map(c => [c.name, c.hash]));

        const added: string[] = [];
        const removed: string[] = [];
        const changed: string[] = [];
        const unchanged: string[] = [];

        // Check remote commands
        for (const [name, hash] of remoteMap) {
            if (!localMap.has(name)) {
                added.push(name);
            } else if (localMap.get(name) !== hash) {
                changed.push(name);
            } else {
                unchanged.push(name);
            }
        }

        // Check for removed commands
        for (const [name] of localMap) {
            if (!remoteMap.has(name)) {
                removed.push(name);
            }
        }

        return { added, removed, changed, unchanged };
    }
}
