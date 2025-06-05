// Type definitions for the File System Access API
// Based on https://wicg.github.io/file-system-access/
// and https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API

declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string | { type: 'write', position?: number, data: BufferSource | Blob | string } | { type: 'seek', position: number } | { type: 'truncate', size: number } ): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
  }
  
  interface FileSystemCreateWritableOptions {
      keepExistingData?: boolean;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
  }
  
  type WellKnownDirectory =
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string | string[]>;
  }

  interface FilePickerOptions {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    id?: string; 
    startIn?: WellKnownDirectory | FileSystemHandle; 
  }

  interface OpenFilePickerOptions extends FilePickerOptions {
    multiple?: boolean;
  }

  interface SaveFilePickerOptions extends FilePickerOptions {
    suggestedName?: string;
  }
  
  interface DirectoryPickerOptions {
    id?: string;
    startIn?: WellKnownDirectory | FileSystemHandle;
    mode?: 'read' | 'readwrite';
  }

  interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;

    FileSystemHandle: {
        prototype: FileSystemHandle;
        new(): FileSystemHandle;
    };
    FileSystemFileHandle: {
        prototype: FileSystemFileHandle;
        new(): FileSystemFileHandle;
    };
    FileSystemDirectoryHandle: {
        prototype: FileSystemDirectoryHandle;
        new(): FileSystemDirectoryHandle;
    };
    FileSystemWritableFileStream: {
      prototype: FileSystemWritableFileStream;
      new(): FileSystemWritableFileStream;
    };
  }

  // Options for getDirectoryHandle, getFileHandle, and removeEntry
  // These were previously removed due to potential duplicate identifiers.
  // If your TypeScript setup (e.g., lib.dom.d.ts) doesn't include them,
  // you might need to uncomment or redefine them.
  // For now, assuming they are provided by standard TypeScript libs.
  interface FileSystemGetDirectoryOptions {
    create?: boolean;
  }
  interface FileSystemGetFileOptions {
    create?: boolean;
  }
  interface FileSystemRemoveOptions {
    recursive?: boolean;
  }

}

// Adding an export to make this file a module, ensuring global augmentations are applied correctly.
export {};
