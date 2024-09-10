// build.js
import esbuild from "esbuild";

export {};

esbuild.build({
    entryPoints: ['src/index.ts'], // Entry point of your TypeScript project
    bundle: true,                  // Bundle all dependencies into a single file
    minify: true,                   // Minify the output
    sourcemap: true,                // Generate a source map for debugging
    target: 'esnext',               // Set the target environment
    platform: 'node',               // Specify platform (can be 'browser' if needed)
    outdir: 'dist',                 // Output directory for built files
    tsconfig: 'tsconfig.json',      // Use your existing tsconfig.json
    format: 'esm',                  // Output as ESModules
    logLevel: 'info'                // Display information during the build
}).catch(() => process.exit(1));