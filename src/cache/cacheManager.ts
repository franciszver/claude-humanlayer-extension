import * as vscode from 'vscode';
import type { CommandFile, GitHubTag } from '../github/types';
import type { CachedTagsData, CachedCommandsData, CacheMetadata } from './types';

const CACHE_VERSION = '1.0.0';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TAGS_CACHE_FILE = 'tags.json';
const COMMANDS_CACHE_DIR = 'commands';
const METADATA_FILE = 'metadata.json';

export class CacheManager {
    private storageUri: vscode.Uri;

    constructor(context: vscode.ExtensionContext) {
        this.storageUri = context.globalStorageUri;
        this.ensureCacheDir();
    }

    private async ensureCacheDir(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(this.storageUri, COMMANDS_CACHE_DIR)
            );
        } catch {
            // Directories may already exist
        }
    }

    async cacheTags(tags: GitHubTag[]): Promise<void> {
        const data: CachedTagsData = {
            tags,
            cachedAt: new Date().toISOString()
        };

        const filePath = vscode.Uri.joinPath(this.storageUri, TAGS_CACHE_FILE);
        await vscode.workspace.fs.writeFile(
            filePath,
            Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
        );
    }

    async getCachedTags(): Promise<GitHubTag[]> {
        const filePath = vscode.Uri.joinPath(this.storageUri, TAGS_CACHE_FILE);

        try {
            const bytes = await vscode.workspace.fs.readFile(filePath);
            const data: CachedTagsData = JSON.parse(Buffer.from(bytes).toString('utf-8'));

            // Check if cache is still valid
            const cachedAt = new Date(data.cachedAt).getTime();
            if (Date.now() - cachedAt > CACHE_TTL_MS) {
                return []; // Cache expired
            }

            return data.tags;
        } catch {
            return [];
        }
    }

    async cacheCommands(tag: string, commands: CommandFile[]): Promise<void> {
        const data: CachedCommandsData = {
            commands,
            tag,
            cachedAt: new Date().toISOString()
        };

        // Sanitize tag name for file system
        const safeTag = tag.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = vscode.Uri.joinPath(
            this.storageUri,
            COMMANDS_CACHE_DIR,
            `${safeTag}.json`
        );

        await vscode.workspace.fs.writeFile(
            filePath,
            Buffer.from(JSON.stringify(data, null, 2), 'utf-8')
        );
    }

    async getCachedCommands(tag: string): Promise<CommandFile[]> {
        const safeTag = tag.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = vscode.Uri.joinPath(
            this.storageUri,
            COMMANDS_CACHE_DIR,
            `${safeTag}.json`
        );

        try {
            const bytes = await vscode.workspace.fs.readFile(filePath);
            const data: CachedCommandsData = JSON.parse(Buffer.from(bytes).toString('utf-8'));

            // Check if cache is still valid
            const cachedAt = new Date(data.cachedAt).getTime();
            if (Date.now() - cachedAt > CACHE_TTL_MS) {
                return []; // Cache expired
            }

            return data.commands;
        } catch {
            return [];
        }
    }

    async getCachedTagsList(): Promise<string[]> {
        const commandsDir = vscode.Uri.joinPath(this.storageUri, COMMANDS_CACHE_DIR);

        try {
            const entries = await vscode.workspace.fs.readDirectory(commandsDir);
            return entries
                .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.json'))
                .map(([name]) => name.replace('.json', ''));
        } catch {
            return [];
        }
    }

    async clearCache(): Promise<void> {
        try {
            // Clear tags cache
            const tagsPath = vscode.Uri.joinPath(this.storageUri, TAGS_CACHE_FILE);
            await vscode.workspace.fs.delete(tagsPath);
        } catch {
            // File may not exist
        }

        try {
            // Clear commands cache
            const commandsDir = vscode.Uri.joinPath(this.storageUri, COMMANDS_CACHE_DIR);
            const entries = await vscode.workspace.fs.readDirectory(commandsDir);

            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) {
                    await vscode.workspace.fs.delete(
                        vscode.Uri.joinPath(commandsDir, name)
                    );
                }
            }
        } catch {
            // Directory may not exist
        }

        // Update metadata
        await this.updateMetadata();
    }

    async cleanupOldCache(): Promise<void> {
        const commandsDir = vscode.Uri.joinPath(this.storageUri, COMMANDS_CACHE_DIR);

        try {
            const entries = await vscode.workspace.fs.readDirectory(commandsDir);

            for (const [name, type] of entries) {
                if (type !== vscode.FileType.File || !name.endsWith('.json')) {
                    continue;
                }

                const filePath = vscode.Uri.joinPath(commandsDir, name);

                try {
                    const bytes = await vscode.workspace.fs.readFile(filePath);
                    const data: CachedCommandsData = JSON.parse(Buffer.from(bytes).toString('utf-8'));

                    const cachedAt = new Date(data.cachedAt).getTime();
                    if (Date.now() - cachedAt > CACHE_TTL_MS * 7) {
                        // Delete cache files older than 7 days
                        await vscode.workspace.fs.delete(filePath);
                    }
                } catch {
                    // Invalid cache file, delete it
                    await vscode.workspace.fs.delete(filePath);
                }
            }
        } catch {
            // Directory may not exist
        }

        await this.updateMetadata();
    }

    private async updateMetadata(): Promise<void> {
        const metadata: CacheMetadata = {
            version: CACHE_VERSION,
            lastCleanup: new Date().toISOString()
        };

        const filePath = vscode.Uri.joinPath(this.storageUri, METADATA_FILE);
        await vscode.workspace.fs.writeFile(
            filePath,
            Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8')
        );
    }

    async getCacheSize(): Promise<{ files: number; bytes: number }> {
        let files = 0;
        let bytes = 0;

        const countDir = async (uri: vscode.Uri): Promise<void> => {
            try {
                const entries = await vscode.workspace.fs.readDirectory(uri);
                for (const [name, type] of entries) {
                    const entryUri = vscode.Uri.joinPath(uri, name);
                    if (type === vscode.FileType.File) {
                        files++;
                        try {
                            const stat = await vscode.workspace.fs.stat(entryUri);
                            bytes += stat.size;
                        } catch {
                            // Skip if we can't stat
                        }
                    } else if (type === vscode.FileType.Directory) {
                        await countDir(entryUri);
                    }
                }
            } catch {
                // Directory may not exist
            }
        };

        await countDir(this.storageUri);
        return { files, bytes };
    }
}
