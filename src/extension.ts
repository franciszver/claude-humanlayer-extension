import * as vscode from 'vscode';
import { GitHubFetcher } from './github';
import { YamlValidator } from './validator';
import { CommandInstaller } from './installer';
import { LockfileManager } from './lockfile';
import { CacheManager } from './cache';
import { CommandBrowserProvider } from './webview/panelProvider';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('HumanLayer');
    outputChannel.appendLine('HumanLayer Command Syncer is now active');

    // Initialize core services
    const cacheManager = new CacheManager(context);
    const githubFetcher = new GitHubFetcher(cacheManager);
    const yamlValidator = new YamlValidator();
    const lockfileManager = new LockfileManager();
    const commandInstaller = new CommandInstaller(lockfileManager);

    // Register webview provider
    const commandBrowserProvider = new CommandBrowserProvider(
        context.extensionUri,
        githubFetcher,
        yamlValidator,
        commandInstaller,
        lockfileManager,
        cacheManager
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'humanlayer.commandBrowser',
            commandBrowserProvider
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('humanlayer.install', async () => {
            await installCommands(githubFetcher, yamlValidator, commandInstaller, cacheManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('humanlayer.update', async () => {
            await updateCommands(githubFetcher, yamlValidator, commandInstaller, lockfileManager, cacheManager);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('humanlayer.openPanel', () => {
            vscode.commands.executeCommand('humanlayer.commandBrowser.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('humanlayer.checkUpdates', async () => {
            await checkForUpdates(githubFetcher, lockfileManager);
        })
    );

    // Check for updates on startup if enabled
    const config = vscode.workspace.getConfiguration('humanlayer');
    if (config.get('autoUpdate')) {
        checkForUpdates(githubFetcher, lockfileManager);
    }

    outputChannel.appendLine('HumanLayer commands registered');
}

async function installCommands(
    fetcher: GitHubFetcher,
    validator: YamlValidator,
    installer: CommandInstaller,
    cache: CacheManager
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open. Please open a folder first.');
        return;
    }

    try {
        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'HumanLayer',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Fetching available tags...' });

                // Get available tags
                const tags = await fetcher.fetchTags();
                if (tags.length === 0) {
                    vscode.window.showErrorMessage('No tags found in HumanLayer repository');
                    return;
                }

                // Let user select a tag
                const config = vscode.workspace.getConfiguration('humanlayer');

                const selectedTag = await vscode.window.showQuickPick(
                    tags.map(t => ({ label: t.name, description: t.name === tags[0].name ? '(latest)' : '' })),
                    { placeHolder: 'Select a version to install' }
                );

                if (!selectedTag) {
                    return;
                }

                progress.report({ message: `Fetching commands from ${selectedTag.label}...` });

                // Fetch commands
                const commands = await fetcher.fetchCommands(selectedTag.label);
                if (commands.length === 0) {
                    vscode.window.showWarningMessage('No commands found in the selected version');
                    return;
                }

                // Validate commands
                progress.report({ message: 'Validating commands...' });
                const validationResults = validator.validateCommands(commands);

                if (validationResults.errors.length > 0) {
                    const showErrors = await vscode.window.showWarningMessage(
                        `Found ${validationResults.errors.length} validation error(s). Continue anyway?`,
                        'Yes',
                        'No'
                    );
                    if (showErrors !== 'Yes') {
                        return;
                    }
                }

                // Install to each workspace folder
                progress.report({ message: 'Installing commands...' });

                const profile = config.get<string>('defaultProfile') || 'full';

                for (const folder of workspaceFolders) {
                    await installer.install(folder.uri, commands, selectedTag.label, profile);
                }

                // Cache the commands
                await cache.cacheCommands(selectedTag.label, commands);

                vscode.window.showInformationMessage(
                    `Successfully installed ${commands.length} HumanLayer commands (${selectedTag.label})`
                );
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Install error: ${message}`);
        vscode.window.showErrorMessage(`Failed to install commands: ${message}`);
    }
}

async function updateCommands(
    fetcher: GitHubFetcher,
    validator: YamlValidator,
    installer: CommandInstaller,
    lockfile: LockfileManager,
    cache: CacheManager
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'HumanLayer',
                cancellable: false
            },
            async (progress) => {
                for (const folder of workspaceFolders) {
                    const currentLockfile = await lockfile.read(folder.uri);
                    if (!currentLockfile) {
                        vscode.window.showWarningMessage(
                            `No HumanLayer commands installed in ${folder.name}. Use 'Install Commands' first.`
                        );
                        continue;
                    }

                    progress.report({ message: `Checking updates for ${folder.name}...` });

                    // Get latest tag
                    const tags = await fetcher.fetchTags();
                    const latestTag = tags[0]?.name;

                    if (!latestTag || latestTag === currentLockfile.tag) {
                        vscode.window.showInformationMessage(
                            `${folder.name} is already up to date (${currentLockfile.tag})`
                        );
                        continue;
                    }

                    // Fetch and validate new commands
                    progress.report({ message: `Fetching ${latestTag}...` });
                    const commands = await fetcher.fetchCommands(latestTag);

                    const validationResults = validator.validateCommands(commands);
                    if (validationResults.errors.length > 0) {
                        const proceed = await vscode.window.showWarningMessage(
                            `Found ${validationResults.errors.length} validation error(s). Update anyway?`,
                            'Yes',
                            'No'
                        );
                        if (proceed !== 'Yes') {
                            continue;
                        }
                    }

                    // Install updates
                    progress.report({ message: `Updating ${folder.name}...` });
                    await installer.install(folder.uri, commands, latestTag, currentLockfile.profile);

                    // Update cache
                    await cache.cacheCommands(latestTag, commands);

                    vscode.window.showInformationMessage(
                        `Updated ${folder.name} from ${currentLockfile.tag} to ${latestTag}`
                    );
                }
            }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Update error: ${message}`);
        vscode.window.showErrorMessage(`Failed to update commands: ${message}`);
    }
}

async function checkForUpdates(
    fetcher: GitHubFetcher,
    lockfile: LockfileManager
): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return;
    }

    try {
        const tags = await fetcher.fetchTags();
        const latestTag = tags[0]?.name;

        if (!latestTag) {
            return;
        }

        for (const folder of workspaceFolders) {
            const currentLockfile = await lockfile.read(folder.uri);
            if (currentLockfile && currentLockfile.tag !== latestTag) {
                const update = await vscode.window.showInformationMessage(
                    `HumanLayer update available: ${currentLockfile.tag} → ${latestTag}`,
                    'Update Now',
                    'Later'
                );

                if (update === 'Update Now') {
                    vscode.commands.executeCommand('humanlayer.update');
                }
                break; // Only show one notification
            }
        }
    } catch (error) {
        // Silently fail for auto-check
        outputChannel.appendLine(`Update check failed: ${error}`);
    }
}

export function deactivate() {
    outputChannel?.dispose();
}
