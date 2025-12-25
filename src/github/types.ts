export interface GitHubTag {
    name: string;
    commit: {
        sha: string;
        url: string;
    };
    zipball_url: string;
    tarball_url: string;
}

export interface GitHubTreeItem {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}

export interface GitHubTree {
    sha: string;
    url: string;
    tree: GitHubTreeItem[];
    truncated: boolean;
}

export interface GitHubBlob {
    sha: string;
    size: number;
    url: string;
    content: string;
    encoding: 'base64' | 'utf-8';
}

export interface CommandFile {
    name: string;
    path: string;
    content: string;
    sha: string;
}

export interface FetchError extends Error {
    statusCode?: number;
    isNetworkError?: boolean;
}
