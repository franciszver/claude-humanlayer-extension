import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as os from 'os';
import type { CommandFile } from '../github/types';
import type { InstallResult } from './types';
import { LockfileManager } from '../lockfile';
import { addToGitignore } from './gitignore';

const COMMANDS_DIR = '.claude/commands';
const HUMANLAYER_DIR = '.claude/commands/humanlayer';

export type InstallLocation = 'workspace' | 'user';

export class CommandInstaller {
    private lockfileManager: LockfileManager;

    constructor(lockfileManager: LockfileManager) {
        this.lockfileManager = lockfileManager;
    }

    private getUserHomeUri(): vscode.Uri {
        return vscode.Uri.file(os.homedir());
    }

    private getInstallUri(workspaceUri: vscode.Uri | undefined, location: InstallLocation): vscode.Uri {
        if (location === 'user') {
            // Return home directory - paths like .claude/commands will be joined to it
            return this.getUserHomeUri();
        }
        if (!workspaceUri) {
            throw new Error('Workspace URI required for workspace installation');
        }
        return workspaceUri;
    }

    async install(
        workspaceUri: vscode.Uri | undefined,
        commands: CommandFile[],
        tag: string,
        profile: string,
        location?: InstallLocation
    ): Promise<InstallResult> {
        const result: InstallResult = {
            success: true,
            installedCount: 0,
            skippedCount: 0,
            errors: []
        };

        try {
            // Get installation location from config if not specified
            const installLocation: InstallLocation = location || (vscode.workspace.getConfiguration('humanlayer').get<InstallLocation>('installLocation', 'workspace') ?? 'workspace');
            const installUri = this.getInstallUri(workspaceUri, installLocation);

            // Ensure directories exist
            await this.ensureDirectories(installUri);

            // Install each command
            for (const command of commands) {
                try {
                    await this.installCommand(installUri, command);
                    result.installedCount++;
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error';
                    result.errors.push(`${command.name}: ${msg}`);
                    result.skippedCount++;
                }
            }

            // Update .gitignore only for workspace installations
            if (installLocation === 'workspace' && workspaceUri) {
                const config = vscode.workspace.getConfiguration('humanlayer');
                if (config.get('autoAddGitignore', true)) {
                    await addToGitignore(workspaceUri);
                }
            }

            // Write lockfile
            await this.lockfileManager.write(installUri, {
                tag,
                profile,
                location: installLocation,
                commands: commands.map(cmd => ({
                    name: cmd.name,
                    path: cmd.path,
                    hash: this.hashContent(cmd.content)
                })),
                timestamp: new Date().toISOString()
            });

            result.success = result.errors.length === 0;
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(msg);
            result.success = false;
        }

        return result;
    }

    private async ensureDirectories(workspaceUri: vscode.Uri): Promise<void> {
        const commandsDir = vscode.Uri.joinPath(workspaceUri, COMMANDS_DIR);
        const humanLayerDir = vscode.Uri.joinPath(workspaceUri, HUMANLAYER_DIR);

        try {
            await vscode.workspace.fs.createDirectory(commandsDir);
        } catch {
            // Directory may already exist
        }

        try {
            await vscode.workspace.fs.createDirectory(humanLayerDir);
        } catch {
            // Directory may already exist
        }
    }

    private async installCommand(installUri: vscode.Uri, command: CommandFile): Promise<void> {
        // Determine the file name from the path
        const fileName = command.path.split('/').pop() || `${command.name}.md`;
        const targetPath = vscode.Uri.joinPath(installUri, HUMANLAYER_DIR, fileName);

        // Check if file already exists and is user-modified
        const existingContent = await this.readExistingFile(targetPath);
        if (existingContent !== null) {
            const existingHash = this.hashContent(existingContent);
            const lockfile = await this.lockfileManager.read(installUri);

            if (lockfile) {
                const lockedCommand = lockfile.commands.find(c => c.name === command.name);
                if (lockedCommand && lockedCommand.hash !== existingHash) {
                    // File has been modified by user, skip
                    throw new Error('User-modified file, skipping');
                }
            }
        }

        // Write the command file
        await vscode.workspace.fs.writeFile(
            targetPath,
            Buffer.from(command.content, 'utf-8')
        );
    }

    private async readExistingFile(uri: vscode.Uri): Promise<string | null> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(bytes).toString('utf-8');
        } catch {
            return null;
        }
    }

    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    async uninstall(workspaceUri: vscode.Uri | undefined, location?: InstallLocation): Promise<void> {
        const installLocation: InstallLocation = location || (vscode.workspace.getConfiguration('humanlayer').get<InstallLocation>('installLocation', 'workspace') ?? 'workspace');
        const installUri = this.getInstallUri(workspaceUri, installLocation);
        const humanLayerDir = vscode.Uri.joinPath(installUri, HUMANLAYER_DIR);

        try {
            await vscode.workspace.fs.delete(humanLayerDir, { recursive: true });
        } catch {
            // Directory may not exist
        }

        // Remove lockfile
        await this.lockfileManager.delete(installUri);
    }

    async getInstalledCommands(workspaceUri: vscode.Uri | undefined, location?: InstallLocation): Promise<string[]> {
        const installLocation: InstallLocation = location || (vscode.workspace.getConfiguration('humanlayer').get<InstallLocation>('installLocation', 'workspace') ?? 'workspace');
        const installUri = this.getInstallUri(workspaceUri, installLocation);
        const humanLayerDir = vscode.Uri.joinPath(installUri, HUMANLAYER_DIR);

        try {
            const entries = await vscode.workspace.fs.readDirectory(humanLayerDir);
            return entries
                .filter(([, type]) => type === vscode.FileType.File)
                .map(([name]) => name)
                .filter(name => !name.endsWith('.disabled'));
        } catch {
            return [];
        }
    }

    async toggleCommand(workspaceUri: vscode.Uri | undefined, commandName: string, enabled: boolean, location?: InstallLocation): Promise<void> {
        const installLocation: InstallLocation = location || (vscode.workspace.getConfiguration('humanlayer').get<InstallLocation>('installLocation', 'workspace') ?? 'workspace');
        const installUri = this.getInstallUri(workspaceUri, installLocation);
        const humanLayerDir = vscode.Uri.joinPath(installUri, HUMANLAYER_DIR);
        const entries = await vscode.workspace.fs.readDirectory(humanLayerDir);

        // Find the command file - match exact name (with any extension)
        const commandFile = entries.find(([name]) => {
            const baseName = name.replace('.disabled', '');
            const nameWithoutExt = baseName.replace(/\.(md|yaml|yml)$/, '');
            return nameWithoutExt === commandName;
        });

        if (!commandFile) {
            throw new Error(`Command not found: ${commandName}`);
        }

        const [currentName] = commandFile;
        const isCurrentlyDisabled = currentName.endsWith('.disabled');

        if (enabled && isCurrentlyDisabled) {
            // Enable: remove .disabled suffix
            const newName = currentName.replace('.disabled', '');
            await vscode.workspace.fs.rename(
                vscode.Uri.joinPath(humanLayerDir, currentName),
                vscode.Uri.joinPath(humanLayerDir, newName)
            );
        } else if (!enabled && !isCurrentlyDisabled) {
            // Disable: add .disabled suffix
            const newName = currentName + '.disabled';
            await vscode.workspace.fs.rename(
                vscode.Uri.joinPath(humanLayerDir, currentName),
                vscode.Uri.joinPath(humanLayerDir, newName)
            );
        }
    }
}
