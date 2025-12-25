// Mock implementation of vscode module for testing

export const workspace = {
    fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        delete: jest.fn(),
        createDirectory: jest.fn()
    },
    getConfiguration: jest.fn(() => ({
        get: jest.fn((key: string, defaultValue: unknown) => defaultValue)
    })),
    workspaceFolders: undefined
};

export const Uri = {
    file: jest.fn((path: string) => ({
        fsPath: path,
        path: path,
        scheme: 'file',
        toString: () => `file://${path}`
    })),
    joinPath: jest.fn((base: { fsPath: string }, ...paths: string[]) => {
        const joined = [base.fsPath, ...paths].join('/');
        return {
            fsPath: joined,
            path: joined,
            scheme: 'file',
            toString: () => `file://${joined}`
        };
    }),
    parse: jest.fn((path: string) => ({
        fsPath: path,
        path: path,
        scheme: 'file'
    }))
};

export const window = {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        append: jest.fn(),
        show: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
    }))
};

export const commands = {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
};

export const FileType = {
    File: 1,
    Directory: 2,
    SymbolicLink: 64
};

export default {
    workspace,
    Uri,
    window,
    commands,
    FileType
};
