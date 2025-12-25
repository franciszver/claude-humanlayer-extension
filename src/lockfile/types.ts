export interface LockfileCommand {
    name: string;
    path: string;
    hash: string;
    disabled?: boolean;
    userModified?: boolean;
}

export interface Lockfile {
    tag: string;
    profile: string;
    location?: 'workspace' | 'user';
    commands: LockfileCommand[];
    timestamp: string;
}
