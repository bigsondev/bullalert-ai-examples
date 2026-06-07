/**
 * Minimal .env loader — zero dependencies. Reads KEY=value lines from a .env
 * file at the repo root (or javascript/.env) into process.env, without
 * overwriting variables that are already set in the real environment.
 *
 * This keeps the examples runnable with just `node script.js` after copying
 * .env.example -> .env, while still letting CI / shell exports take precedence.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function loadEnv() {
  const candidates = [
    join(here, '..', '..', '.env'), // repo root .env
    join(here, '..', '.env'),       // javascript/.env
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      // Strip optional surrounding quotes.
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  }
}
