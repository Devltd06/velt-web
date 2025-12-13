// Small editor-only shims for the Supabase Edge Functions runtime (Deno + npm: imports)
// These types help the editor/tsserver understand the runtime imports used by Deno-based functions

// Allow `npm:` style imports to be treated as modules in the editor
declare module 'npm:@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}

// If you import the functions runtime helper types, declare the module so the editor won't complain
declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// Minimal Deno global(s) for the editor. This is intentionally loose — runtime provides real types.
declare global {
  // loose Deno declaration for editor only
  const Deno: any;
}

// no exports - keep this file as global augmentation for the editor
