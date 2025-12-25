import * as vscode from 'vscode';

const HUMANLAYER_GITIGNORE_ENTRIES = [
    '# HumanLayer Command Syncer',
    '.claude/commands/humanlayer/',
    '.claude/commands/humanlayer.lock.json'
];

const HUMANLAYER_MARKER = '# HumanLayer Command Syncer';

export async function addToGitignore(workspaceUri: vscode.Uri): Promise<void> {
    const gitignorePath = vscode.Uri.joinPath(workspaceUri, '.gitignore');

    let existingContent = '';

    try {
        const existingBytes = await vscode.workspace.fs.readFile(gitignorePath);
        existingContent = Buffer.from(existingBytes).toString('utf-8');
    } catch {
        // .gitignore doesn't exist, we'll create it
    }

    // Check if already added
    if (existingContent.includes(HUMANLAYER_MARKER)) {
        return;
    }

    // Add entries
    const newContent = existingContent.trimEnd() + '\n\n' + HUMANLAYER_GITIGNORE_ENTRIES.join('\n') + '\n';

    await vscode.workspace.fs.writeFile(
        gitignorePath,
        Buffer.from(newContent, 'utf-8')
    );
}

export async function isInGitignore(workspaceUri: vscode.Uri): Promise<boolean> {
    const gitignorePath = vscode.Uri.joinPath(workspaceUri, '.gitignore');

    try {
        const content = await vscode.workspace.fs.readFile(gitignorePath);
        return Buffer.from(content).toString('utf-8').includes(HUMANLAYER_MARKER);
    } catch {
        return false;
    }
}

export async function removeFromGitignore(workspaceUri: vscode.Uri): Promise<void> {
    const gitignorePath = vscode.Uri.joinPath(workspaceUri, '.gitignore');

    try {
        const content = await vscode.workspace.fs.readFile(gitignorePath);
        let text = Buffer.from(content).toString('utf-8');

        // Remove HumanLayer entries
        for (const entry of HUMANLAYER_GITIGNORE_ENTRIES) {
            text = text.replace(entry + '\n', '');
        }

        // Clean up extra newlines
        text = text.replace(/\n{3,}/g, '\n\n');

        await vscode.workspace.fs.writeFile(
            gitignorePath,
            Buffer.from(text, 'utf-8')
        );
    } catch {
        // .gitignore doesn't exist or can't be read, nothing to do
    }
}
