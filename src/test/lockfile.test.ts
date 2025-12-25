import type { Lockfile } from '../lockfile/types';

// vscode is mocked via moduleNameMapper in jest.config.js

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

        it('should support optional location field', () => {
            const workspaceLockfile: Lockfile = {
                tag: 'v1.0.0',
                profile: 'full',
                location: 'workspace',
                commands: [],
                timestamp: '2024-12-24T00:00:00.000Z'
            };

            const userLockfile: Lockfile = {
                tag: 'v1.0.0',
                profile: 'full',
                location: 'user',
                commands: [],
                timestamp: '2024-12-24T00:00:00.000Z'
            };

            const legacyLockfile: Lockfile = {
                tag: 'v1.0.0',
                profile: 'full',
                commands: [],
                timestamp: '2024-12-24T00:00:00.000Z'
            };

            expect(workspaceLockfile.location).toBe('workspace');
            expect(userLockfile.location).toBe('user');
            expect(legacyLockfile.location).toBeUndefined();
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
