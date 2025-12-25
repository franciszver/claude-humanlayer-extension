import type { CommandFile } from '../github/types';

export interface InstallResult {
    success: boolean;
    installedCount: number;
    skippedCount: number;
    errors: string[];
}

export interface InstalledCommand extends CommandFile {
    enabled: boolean;
    modified: boolean;
    installedAt: string;
}
