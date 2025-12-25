import * as yaml from 'js-yaml';
import type { CommandFile } from '../github/types';
import type { ValidationError, ValidationResult, ClaudeCommandSchema } from './types';

export class YamlValidator {
    validateCommands(commands: CommandFile[]): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];
        const commandNames = new Map<string, string>();

        for (const command of commands) {
            // Skip markdown files - they don't need YAML validation
            if (command.path.endsWith('.md')) {
                continue;
            }

            // Validate YAML syntax
            const parseResult = this.parseYaml(command);
            if (parseResult.error) {
                errors.push(parseResult.error);
                continue;
            }

            const parsed = parseResult.data;
            if (!parsed) {
                continue;
            }

            // Validate schema
            const schemaErrors = this.validateSchema(command, parsed);
            errors.push(...schemaErrors.filter(e => e.severity === 'error'));
            warnings.push(...schemaErrors.filter(e => e.severity === 'warning'));

            // Check for duplicate command names
            const cmdName = parsed.name || command.name;
            if (commandNames.has(cmdName)) {
                errors.push({
                    file: command.path,
                    message: `Duplicate command name "${cmdName}" (also in ${commandNames.get(cmdName)})`,
                    severity: 'error'
                });
            } else {
                commandNames.set(cmdName, command.path);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    private parseYaml(command: CommandFile): { data?: ClaudeCommandSchema; error?: ValidationError } {
        try {
            const data = yaml.load(command.content) as ClaudeCommandSchema;
            return { data };
        } catch (e) {
            const yamlError = e as yaml.YAMLException;
            return {
                error: {
                    file: command.path,
                    message: `Invalid YAML: ${yamlError.message}`,
                    line: yamlError.mark?.line,
                    severity: 'error'
                }
            };
        }
    }

    private validateSchema(command: CommandFile, data: ClaudeCommandSchema): ValidationError[] {
        const issues: ValidationError[] = [];

        // Check for required fields (based on Claude command format)
        // Note: The exact schema depends on Claude Code's requirements
        // For now, we check common fields

        if (!data.prompt && !data.description) {
            issues.push({
                file: command.path,
                message: 'Command should have either a "prompt" or "description" field',
                severity: 'warning'
            });
        }

        // Validate temperature if present
        if (data.temperature !== undefined) {
            if (typeof data.temperature !== 'number' || data.temperature < 0 || data.temperature > 2) {
                issues.push({
                    file: command.path,
                    message: 'Temperature must be a number between 0 and 2',
                    severity: 'error'
                });
            }
        }

        // Validate max_tokens if present
        if (data.max_tokens !== undefined) {
            if (typeof data.max_tokens !== 'number' || data.max_tokens < 1) {
                issues.push({
                    file: command.path,
                    message: 'max_tokens must be a positive number',
                    severity: 'error'
                });
            }
        }

        // Check for potentially invalid model names
        if (data.model !== undefined) {
            const validModelPrefixes = [
                'claude-3',
                'claude-opus',
                'claude-sonnet'
            ];

            const modelStr = String(data.model);
            const isValidModel = validModelPrefixes.some(prefix => modelStr.startsWith(prefix));
            if (!isValidModel) {
                issues.push({
                    file: command.path,
                    message: `Unknown model "${data.model}". This may be intentional for future models.`,
                    severity: 'warning'
                });
            }
        }

        return issues;
    }

    validateSingleCommand(content: string, fileName: string): ValidationResult {
        const command: CommandFile = {
            name: fileName,
            path: fileName,
            content,
            sha: ''
        };

        return this.validateCommands([command]);
    }
}
