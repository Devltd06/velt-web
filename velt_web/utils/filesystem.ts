// utils/filesystem.ts
// Centralised helper to handle the new expo-file-system API while providing a
// safe fallback to the legacy API where a deprecated method (downloadAsync / uploadAsync)
// is still required for compatibility.

import * as FileSystemNative from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';

// Export the primary FileSystem object so callers still get access to the modern API
export const FileSystem = FileSystemNative as typeof FileSystemNative & typeof FileSystemLegacy;

// Provide downloadAsync and uploadAsync helpers which prefer legacy implementations
// when available (to avoid deprecation warnings) and otherwise fall back to the
// modern API if present.
export const downloadAsync = (FileSystemLegacy as any)?.downloadAsync ?? (FileSystemNative as any)?.downloadAsync;
export const uploadAsync = (FileSystemLegacy as any)?.uploadAsync ?? (FileSystemNative as any)?.uploadAsync;

// Convenience alias for other code that expects to treat FileSystem as `any`.
export const FS_ANY: any = FileSystem;

export default { FileSystem, downloadAsync, uploadAsync, FS_ANY };
