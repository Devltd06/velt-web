declare module 'expo-web-browser';
declare module 'expo-symbols';
declare module 'react-native-proximity';
declare module 'expo-proximity';

// add minimal FileSystem shims for properties used in this project
declare module 'expo-file-system' {
  const cacheDirectory: string | null;
  const documentDirectory: string | null;
  const copyAsync: any;
  export { cacheDirectory, documentDirectory, copyAsync };
}

// Allow treating AV playback status as any in a few places
declare module 'expo-av' {
  export const Audio: any;
  export const Video: any;
}

// fallback for Cloudinary upload form usage
declare interface FormData {
  append(name: string, value: any, fileName?: string): void;
}

export {};
// declarations.d.ts
declare module "*.png" {
  const value: any;
  export default value;
}

declare module "*.jpg" {
  const value: any;
  export default value;
}

declare module "*.jpeg" {
  const value: any;
  export default value;
}

declare module "*.svg" {
  const value: any;
  export default value;
}

// Editor-friendly wildcard module declarations to help TypeScript/VS Code
// resolve project-local import aliases used across the repo (e.g. '@/components/..', 'app/...').
// These are intentionally permissive (any) — they remove spurious "Cannot find module" errors
// while TS resolves actual types. If you prefer stricter types, add more granular declarations.
declare module '@/*';
declare module 'app/*';
declare module 'lib/*';
declare module '@/lib/*';
declare module '@/components/*';
declare module '@/hooks/*';
