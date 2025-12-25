import { CacheManager } from '../cache';
import type { GitHubTag, GitHubTree, GitHubBlob, CommandFile, FetchError } from './types';

const GITHUB_API_BASE = 'https://api.github.com';
const HUMANLAYER_REPO = 'humanlayer/humanlayer';
const COMMANDS_PATH = '.claude/commands';

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

    async fetchTags(): Promise<GitHubTag[]> {
        // Try cache first
        const cachedTags = await this.cache.getCachedTags();

        try {
            const url = `${GITHUB_API_BASE}/repos/${HUMANLAYER_REPO}/tags`;
            const tags = await this.fetch<GitHubTag[]>(url);

            // Cache the tags
            await this.cache.cacheTags(tags);

            return tags;
        } catch (error) {
            // Fall back to cache on network error
            if ((error as FetchError).isNetworkError && cachedTags.length > 0) {
                return cachedTags;
            }
            throw error;
        }
    }

    async fetchCommands(tag: string): Promise<CommandFile[]> {
        // Try cache first
        const cachedCommands = await this.cache.getCachedCommands(tag);

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
        try {
            await this.fetch<{ rate: { remaining: number } }>(
                `${GITHUB_API_BASE}/rate_limit`
            );
            return true;
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
