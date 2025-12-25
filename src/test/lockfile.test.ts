import { describe, it, expect, vi } from 'vitest';
import type { Lockfile } from '../lockfile/types';

// Mock vscode module
vi.mock('vscode', () => ({
    workspace: {
        fs: {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            delete: vi.fn()
        }
    },
    Uri: {
        joinPath: vi.fn((base, ...paths) => ({
            fsPath: paths.join('/'),
            toString: () => paths.join('/')
        }))
    }
}));

describe('Lockfile Types', () => {
    describe('Lockfile interface', () => {
        it('should have correct structure', () => {
            const lockfile: Lockfile = {
                tag: 'v1.0.0',
                profile: 'full',
                commands: [
                    {
                        name: 'test-command',
                        path: '.claude/commands/test.md',
                        hash: 'abc123def456'
                    }
                ],
                timestamp: '2024-12-24T00:00:00.000Z'
            };

            expect(lockfile.tag).toBe('v1.0.0');
            expect(lockfile.profile).toBe('full');
            expect(lockfile.commands).toHaveLength(1);
            expect(lockfile.commands[0].name).toBe('test-command');
        });

        it('should support disabled and userModified flags', () => {
            const lockfile: Lockfile = {
                tag: 'v1.0.0',
                profile: 'minimal',
                commands: [
                    {
                        name: 'disabled-command',
                        path: '.claude/commands/disabled.md',
                        hash: 'abc123',
                        disabled: true,
                        userModified: false
                    },
                    {
                        name: 'modified-command',
                        path: '.claude/commands/modified.md',
                        hash: 'def456',
                        disabled: false,
                        userModified: true
                    }
                ],
                timestamp: '2024-12-24T00:00:00.000Z'
            };

            const disabledCmd = lockfile.commands.find(c => c.name === 'disabled-command');
            const modifiedCmd = lockfile.commands.find(c => c.name === 'modified-command');

            expect(disabledCmd?.disabled).toBe(true);
            expect(modifiedCmd?.userModified).toBe(true);
        });
    });
});
