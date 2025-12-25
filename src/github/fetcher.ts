import { CacheManager } from '../cache';
import type { GitHubTag, GitHubTree, GitHubBlob, CommandFile, FetchError } from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const HUMANLAYER_REPO = 'humanlayer/humanlayer';
const COMMANDS_PATH = '.claude/commands';

/**
 * Parse a semver string into comparable parts
 * Returns null if not a valid semver
 */
function parseSemver(tag: string): { major: number; minor: number; patch: number } | null {
    // Remove leading 'v' if present
    const version = tag.startsWith('v') ? tag.slice(1) : tag;
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return null;
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10)
    };
}

/**
 * Compare two semver versions
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
function compareSemver(a: { major: number; minor: number; patch: number }, b: { major: number; minor: number; patch: number }): number {
    if (a.major !== b.major) {
        return a.major - b.major;
    }
    if (a.minor !== b.minor) {
        return a.minor - b.minor;
    }
    return a.patch - b.patch;
}

/**
 * Find the latest semver tag from a list of tags
 */
function getLatestSemverTag(tags: GitHubTag[]): GitHubTag | null {
    let latest: GitHubTag | null = null;
    let latestVersion: { major: number; minor: number; patch: number } | null = null;

    for (const tag of tags) {
        const version = parseSemver(tag.name);
        if (version) {
            if (!latestVersion || compareSemver(version, latestVersion) > 0) {
                latest = tag;
                latestVersion = version;
            }
        }
    }

    return latest;
}

export class GitHubFetcher {
    private cache: CacheManager;
    private rateLimitRemaining: number = 60;
    private rateLimitReset: number = 0;

    constructor(cache: CacheManager) {
        this.cache = cache;
    }

    private async fetch<T>(url: string): Promise<T> {
        // Check rate limit
        if (this.rateLimitRemaining <= 0 && Date.now() < this.rateLimitReset) {
            const waitTime = Math.ceil((this.rateLimitReset - Date.now()) / 1000);
            throw this.createError(`GitHub API rate limit exceeded. Resets in ${waitTime} seconds.`, 429);
        }

        try {
            const response = await globalThis.fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'HumanLayer-Command-Syncer'
                }
            });

            // Update rate limit info
            const remaining = response.headers.get('X-RateLimit-Remaining');
            const reset = response.headers.get('X-RateLimit-Reset');

            if (remaining) {
                this.rateLimitRemaining = parseInt(remaining, 10);
            }
            if (reset) {
                this.rateLimitReset = parseInt(reset, 10) * 1000;
            }

            if (!response.ok) {
                throw this.createError(
                    `GitHub API error: ${response.statusText}`,
                    response.status
                );
            }

            return await response.json() as T;
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                const networkError = this.createError('Network error: Unable to reach GitHub', 0);
                networkError.isNetworkError = true;
                throw networkError;
            }
            throw error;
        }
    }

    private createError(message: string, statusCode: number): FetchError {
        const error = new Error(message) as FetchError;
        error.statusCode = statusCode;
        return error;
    }

    async fetchTags(forceRefresh = false): Promise<GitHubTag[]> {
        // Use cache if valid and not forcing refresh
        const cachedTags = await this.cache.getCachedTags();
        if (!forceRefresh && cachedTags.length > 0) {
            return cachedTags;
        }

        try {
            const url = `${GITHUB_API_BASE}/repos/${HUMANLAYER_REPO}/tags`;
            const tags = await this.fetch<GitHubTag[]>(url);

            // Cache the tags
            await this.cache.cacheTags(tags);

            // Auto-cache the latest semver version (silently in background)
            const latestTag = getLatestSemverTag(tags);
            if (latestTag) {
                // Check if already cached (with valid TTL)
                const cachedCommands = await this.cache.getCachedCommands(latestTag.name);
                if (cachedCommands.length === 0) {
                    // Fetch and cache in background (don't await, don't block)
                    // Use forceRefresh=true to ensure we actually fetch
                    this.fetchCommands(latestTag.name, true).catch(() => {
                        // Silently ignore errors during background caching
                    });
                }
            }

            return tags;
        } catch (error) {
            // Fall back to cached tags that have commands available (for offline mode)
            if ((error as FetchError).isNetworkError) {
                const cachedTagNames = await this.cache.getCachedTagsList();
                if (cachedTagNames.length > 0) {
                    // Return only tags that have cached commands
                    const tagsWithCache = cachedTags.filter(t => cachedTagNames.includes(t.name));
                    if (tagsWithCache.length > 0) {
                        return tagsWithCache;
                    }
                    // If no match in cached tags list, create minimal tag objects from cached tag names
                    return cachedTagNames.map(name => ({
                        name,
                        commit: { sha: '', url: '' },
                        zipball_url: '',
                        tarball_url: ''
                    }));
                }
            }
            throw error;
        }
    }

    async fetchCommands(tag: string, forceRefresh = false): Promise<CommandFile[]> {
        // Use cache if valid and not forcing refresh
        const cachedCommands = await this.cache.getCachedCommands(tag);
        if (!forceRefresh && cachedCommands.length > 0) {
            return cachedCommands;
        }

        try {
            // Get the tree for the tag
            const treeUrl = `${GITHUB_API_BASE}/repos/${HUMANLAYER_REPO}/git/trees/${tag}?recursive=1`;
            const tree = await this.fetch<GitHubTree>(treeUrl);

            // Filter for command files
            const commandItems = tree.tree.filter(item =>
                item.type === 'blob' &&
                item.path.startsWith(COMMANDS_PATH) &&
                (item.path.endsWith('.md') || item.path.endsWith('.yaml') || item.path.endsWith('.yml'))
            );

            // Fetch each command file
            const commands: CommandFile[] = [];

            for (const item of commandItems) {
                const content = await this.fetchFileContent(item.sha);
                const fileName = item.path.split('/').pop() || item.path;

                commands.push({
                    name: fileName.replace(/\.(md|yaml|yml)$/, ''),
                    path: item.path,
                    content,
                    sha: item.sha
                });
            }

            // Cache the commands
            await this.cache.cacheCommands(tag, commands);

            return commands;
        } catch (error) {
            // Fall back to cache on network error
            if ((error as FetchError).isNetworkError && cachedCommands.length > 0) {
                return cachedCommands;
            }
            throw error;
        }
    }

    async fetchFileContent(sha: string): Promise<string> {
        const url = `${GITHUB_API_BASE}/repos/${HUMANLAYER_REPO}/git/blobs/${sha}`;
        const blob = await this.fetch<GitHubBlob>(url);

        if (blob.encoding === 'base64') {
            return Buffer.from(blob.content, 'base64').toString('utf-8');
        }

        return blob.content;
    }

    async isOnline(): Promise<boolean> {
        // Use a lightweight HEAD request to check connectivity without consuming rate limit
        try {
            const response = await globalThis.fetch(`${GITHUB_API_BASE}/zen`, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'HumanLayer-Command-Syncer'
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitStatus(): { remaining: number; resetsAt: Date } {
        return {
            remaining: this.rateLimitRemaining,
            resetsAt: new Date(this.rateLimitReset)
        };
    }
}
