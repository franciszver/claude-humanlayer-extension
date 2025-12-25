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
    commands: LockfileCommand[];
    timestamp: string;
}
