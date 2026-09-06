import { cp, mkdir, readdir, rm } from 'node:fs/promises';
const output = new URL('../public/generated/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const model of ['heritage', 'commodore']) {
  const source = new URL(`../models/${model}/`, import.meta.url);
  const target = new URL(`models/${model}/`, output);
  await mkdir(target, { recursive: true });
  for (const file of await readdir(source)) {
    if (/\.(glb|blend|json)$/.test(file)) await cp(new URL(file, source), new URL(file, target));
  }
}
await cp(new URL('../previews/', import.meta.url), new URL('previews/', output), { recursive: true });
