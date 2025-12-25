import { describe, it, expect } from 'vitest';
import { YamlValidator } from '../validator';
import type { CommandFile } from '../github/types';

describe('YamlValidator', () => {
    const validator = new YamlValidator();

    describe('validateCommands', () => {
        it('should pass valid YAML commands', () => {
            const commands: CommandFile[] = [
                {
                    name: 'test-command',
                    path: '.claude/commands/test.yaml',
                    content: `
name: test-command
description: A test command
prompt: Do something helpful
`,
                    sha: 'abc123'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid YAML syntax', () => {
            const commands: CommandFile[] = [
                {
                    name: 'bad-yaml',
                    path: '.claude/commands/bad.yaml',
                    content: `
name: bad
description: [invalid yaml
`,
                    sha: 'abc123'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message).toContain('Invalid YAML');
        });

        it('should detect duplicate command names', () => {
            const commands: CommandFile[] = [
                {
                    name: 'duplicate',
                    path: '.claude/commands/cmd1.yaml',
                    content: 'name: duplicate\nprompt: First',
                    sha: 'abc1'
                },
                {
                    name: 'duplicate',
                    path: '.claude/commands/cmd2.yaml',
                    content: 'name: duplicate\nprompt: Second',
                    sha: 'abc2'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.message.includes('Duplicate'))).toBe(true);
        });

        it('should skip markdown files', () => {
            const commands: CommandFile[] = [
                {
                    name: 'readme',
                    path: '.claude/commands/README.md',
                    content: '# This is markdown\nNot valid YAML at all: [',
                    sha: 'abc123'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should warn on missing prompt/description', () => {
            const commands: CommandFile[] = [
                {
                    name: 'empty',
                    path: '.claude/commands/empty.yaml',
                    content: 'name: empty',
                    sha: 'abc123'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0].message).toContain('prompt');
        });

        it('should validate temperature range', () => {
            const commands: CommandFile[] = [
                {
                    name: 'bad-temp',
                    path: '.claude/commands/bad-temp.yaml',
                    content: 'name: test\ntemperature: 5\nprompt: test',
                    sha: 'abc123'
                }
            ];

            const result = validator.validateCommands(commands);
            expect(result.errors.some(e => e.message.includes('Temperature'))).toBe(true);
        });
    });

    describe('validateSingleCommand', () => {
        it('should validate a single command string', () => {
            const content = `
name: single
prompt: Test prompt
`;
            const result = validator.validateSingleCommand(content, 'test.yaml');
            expect(result.valid).toBe(true);
        });
    });
});
