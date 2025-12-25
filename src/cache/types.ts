import type { CommandFile, GitHubTag } from '../github/types';

export interface CachedTagsData {
    tags: GitHubTag[];
    cachedAt: string;
}

export interface CachedCommandsData {
    commands: CommandFile[];
    tag: string;
    cachedAt: string;
}

export interface CacheMetadata {
    version: string;
    lastCleanup: string;
}
