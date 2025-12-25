import * as vscode from 'vscode';
import type { CommandFile } from '../github/types';
import type { CommandDiff } from './types';

const HUMANLAYER_DIR = '.claude/commands/humanlayer';

export class DiffViewer {
    async showDiff(
        workspaceUri: vscode.Uri,
        oldCommand: CommandFile | null,
        newCommand: CommandFile | null
    ): Promise<void> {
        if (!oldCommand && !newCommand) {
            return;
        }

        const commandName = oldCommand?.name || newCommand?.name || 'unknown';

        if (!oldCommand && newCommand) {
            // New command - show content
            const doc = await vscode.workspace.openTextDocument({
                content: newCommand.content,
                language: this.getLanguage(newCommand.path)
            });
            await vscode.window.showTextDocument(doc, { preview: true });
            return;
        }

        if (oldCommand && !newCommand) {
            // Removed command - show old content with warning
            const doc = await vscode.workspace.openTextDocument({
                content: `// This command will be removed\n\n${oldCommand.content}`,
                language: this.getLanguage(oldCommand.path)
            });
            await vscode.window.showTextDocument(doc, { preview: true });
            return;
        }

        if (oldCommand && newCommand) {
            // Modified - show diff
            const oldUri = vscode.Uri.parse(`humanlayer:${commandName}/old`);
            const newUri = vscode.Uri.parse(`humanlayer:${commandName}/new`);

            // Register content provider temporarily
            const disposable = vscode.workspace.registerTextDocumentContentProvider('humanlayer', {
                provideTextDocumentContent(uri: vscode.Uri): string {
                    if (uri.path.endsWith('/old')) {
                        return oldCommand.content;
                    } else {
                        return newCommand.content;
                    }
                }
            });

            await vscode.commands.executeCommand(
                'vscode.diff',
                oldUri,
                newUri,
                `${commandName}: ${oldCommand.sha.slice(0, 7)} → ${newCommand.sha.slice(0, 7)}`
            );

            // Clean up after a delay
            setTimeout(() => disposable.dispose(), 60000);
        }
    }

    async showMultipleDiffs(
        workspaceUri: vscode.Uri,
        diffs: CommandDiff[]
    ): Promise<boolean> {
        if (diffs.length === 0) {
            return true;
        }

        // Show a quick pick to select which diff to view
        const items = diffs.map(diff => ({
            label: diff.name,
            description: diff.type,
            detail: this.getDiffSummary(diff),
            diff
        }));

        // Add "Apply All" option
        items.unshift({
            label: '$(check-all) Apply All Changes',
            description: `${diffs.length} file(s)`,
            detail: 'Apply all updates without reviewing individually',
            diff: null as unknown as CommandDiff
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a command to preview changes, or apply all',
            canPickMany: false
        });

        if (!selected) {
            return false; // User cancelled
        }

        if (!selected.diff) {
            // "Apply All" selected
            return true;
        }

        // Show the selected diff
        await this.showDiff(
            workspaceUri,
            selected.diff.oldContent ? {
                name: selected.diff.name,
                path: `${HUMANLAYER_DIR}/${selected.diff.name}`,
                content: selected.diff.oldContent,
                sha: 'old'
            } : null,
            selected.diff.newContent ? {
                name: selected.diff.name,
                path: `${HUMANLAYER_DIR}/${selected.diff.name}`,
                content: selected.diff.newContent,
                sha: 'new'
            } : null
        );

        // Ask to continue
        const continueChoice = await vscode.window.showInformationMessage(
            'Continue with update?',
            'Apply All',
            'Review More',
            'Cancel'
        );

        if (continueChoice === 'Apply All') {
            return true;
        } else if (continueChoice === 'Review More') {
            // Remove the reviewed diff and show again
            const remainingDiffs = diffs.filter(d => d.name !== selected.diff.name);
            return this.showMultipleDiffs(workspaceUri, remainingDiffs);
        }

        return false;
    }

    private getLanguage(path: string): string {
        if (path.endsWith('.yaml') || path.endsWith('.yml')) {
            return 'yaml';
        }
        if (path.endsWith('.md')) {
            return 'markdown';
        }
        return 'plaintext';
    }

    private getDiffSummary(diff: CommandDiff): string {
        if (diff.type === 'added') {
            return 'New command';
        }
        if (diff.type === 'removed') {
            return 'Will be removed';
        }

        // Count lines changed
        const oldLines = diff.oldContent.split('\n').length;
        const newLines = diff.newContent.split('\n').length;
        const lineDiff = newLines - oldLines;

        if (lineDiff > 0) {
            return `+${lineDiff} lines`;
        } else if (lineDiff < 0) {
            return `${lineDiff} lines`;
        }
        return 'Modified';
    }
}
