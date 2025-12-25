export interface ValidationError {
    file: string;
    message: string;
    line?: number;
    severity: 'error' | 'warning';
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export interface ClaudeCommandSchema {
    name?: string;
    description?: string;
    prompt?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
}
