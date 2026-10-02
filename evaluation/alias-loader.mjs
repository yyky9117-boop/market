import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const projectRoot = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const mapped = path.resolve(projectRoot, specifier.slice(2));
      return { url: pathToFileURL(path.extname(mapped) ? mapped : `${mapped}.ts`).href, shortCircuit: true };
    }
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
      for (const extension of ['.ts', '.mjs', '.json']) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL);
        if (fs.existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
