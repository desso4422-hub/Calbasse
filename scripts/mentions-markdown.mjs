#!/usr/bin/env node
// Produit docs/confidentialite.md à partir de src/lib/mentions.ts (source unique).
//   npm run mentions
import { mkdirSync, writeFileSync } from 'node:fs';
import { enMarkdown } from '../src/lib/mentions.ts';

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/confidentialite.md', import.meta.url), enMarkdown());
console.log('docs/confidentialite.md écrit');
