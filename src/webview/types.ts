export interface WebviewMessage {
    type: string;
    payload?: unknown;
}

export interface CommandInfo {
    name: string;
    path: string;
    description?: string;
    installed: boolean;
    enabled: boolean;
    modified: boolean;
    hasUpdate: boolean;
}

export interface PanelState {
    tags: string[];
    selectedTag: string;
    profile: string;
    commands: CommandInfo[];
    isLoading: boolean;
    isOffline: boolean;
    error?: string;
}

// Messages from webview to extension
export type WebviewToExtensionMessage =
    | { type: 'ready' }
    | { type: 'fetchTags' }
    | { type: 'fetchCommands'; tag: string }
    | { type: 'install'; tag: string; profile: string }
    | { type: 'update' }
    | { type: 'toggleCommand'; name: string; enabled: boolean }
    | { type: 'previewCommand'; name: string }
    | { type: 'refresh' }
    | { type: 'clearCache' };

// Messages from extension to webview
export type ExtensionToWebviewMessage =
    | { type: 'setState'; state: Partial<PanelState> }
    | { type: 'showError'; message: string }
    | { type: 'showSuccess'; message: string }
    | { type: 'setLoading'; isLoading: boolean };
