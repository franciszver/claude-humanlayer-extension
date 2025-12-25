import * as crypto from 'crypto';
import type { CommandFile } from '../github/types';
import type { LockfileCommand } from '../lockfile/types';
import type { CommandDiff } from './types';

export class CommandDiffer {
    compareCommands(
        localCommands: LockfileCommand[],
        remoteCommands: CommandFile[]
    ): {
        added: CommandFile[];
        removed: LockfileCommand[];
        modified: Array<{ local: LockfileCommand; remote: CommandFile }>;
        unchanged: LockfileCommand[];
    } {
        const localMap = new Map(localCommands.map(c => [c.name, c]));
        const remoteMap = new Map(remoteCommands.map(c => [c.name, c]));

        const added: CommandFile[] = [];
        const removed: LockfileCommand[] = [];
        const modified: Array<{ local: LockfileCommand; remote: CommandFile }> = [];
        const unchanged: LockfileCommand[] = [];

        // Check remote commands
        for (const [name, remote] of remoteMap) {
            const local = localMap.get(name);
            if (!local) {
                added.push(remote);
            } else {
                const remoteHash = this.hashContent(remote.content);
                if (local.hash !== remoteHash) {
                    modified.push({ local, remote });
                } else {
                    unchanged.push(local);
                }
            }
        }

        // Check for removed
        for (const [name, local] of localMap) {
            if (!remoteMap.has(name)) {
                removed.push(local);
            }
        }

        return { added, removed, modified, unchanged };
    }

    createDiffs(
        localCommands: Map<string, string>,
        remoteCommands: CommandFile[]
    ): CommandDiff[] {
        const diffs: CommandDiff[] = [];
        const remoteMap = new Map(remoteCommands.map(c => [c.name, c]));

        // Check remote commands
        for (const [name, remote] of remoteMap) {
            const localContent = localCommands.get(name);

            if (!localContent) {
                diffs.push({
                    name,
                    oldContent: '',
                    newContent: remote.content,
                    type: 'added'
                });
            } else if (localContent !== remote.content) {
                diffs.push({
                    name,
                    oldContent: localContent,
                    newContent: remote.content,
                    type: 'modified'
                });
            }
        }

        // Check for removed
        for (const [name, content] of localCommands) {
            if (!remoteMap.has(name)) {
                diffs.push({
                    name,
                    oldContent: content,
                    newContent: '',
                    type: 'removed'
                });
            }
        }

        return diffs;
    }

    filterUserModified(
        diffs: CommandDiff[],
        modifiedCommands: string[]
    ): {
        toUpdate: CommandDiff[];
        skipped: CommandDiff[];
    } {
        const modifiedSet = new Set(modifiedCommands);

        return {
            toUpdate: diffs.filter(d => !modifiedSet.has(d.name)),
            skipped: diffs.filter(d => modifiedSet.has(d.name))
        };
    }

    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }
}
