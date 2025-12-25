export interface UpdateInfo {
    currentTag: string;
    latestTag: string;
    hasUpdate: boolean;
    changedCommands: string[];
    addedCommands: string[];
    removedCommands: string[];
}

export interface CommandDiff {
    name: string;
    oldContent: string;
    newContent: string;
    type: 'added' | 'modified' | 'removed';
}
