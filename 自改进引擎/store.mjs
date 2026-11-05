import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.mjs';

const BASE = path.join(config.root, '.shil');
const DIR = path.join(BASE, 'snapshots');
const POINTER = path.join(BASE, 'current.json');

const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function readPointer() {
  if (!fs.existsSync(POINTER)) return null;
  try {
    return JSON.parse(fs.readFileSync(POINTER, 'utf8'));
  } catch {
    return null;
  }
}

export function listSnapshots() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .map((id) => {
      const m = path.join(DIR, id, 'manifest.json');
      if (!fs.existsSync(m)) return null;
      return JSON.parse(fs.readFileSync(m, 'utf8'));
    })
    .filter(Boolean)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function createSnapshot(label = 'auto', scores = null) {
  fs.mkdirSync(DIR, { recursive: true });
  const parent = readPointer();
  const id = `${stamp()}-${hash(label)}`;
  const dir = path.join(DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const files = {};
  for (const name of config.artifacts) {
    const src = path.join(config.root, name);
    if (!fs.existsSync(src)) continue;
    const content = fs.readFileSync(src, 'utf8');
    files[name] = hash(content);
    fs.writeFileSync(path.join(dir, name), content);
  }

  const manifest = {
    id,
    label,
    createdAt: new Date().toISOString(),
    parent: parent?.id ?? null,
    files,
    scores,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(POINTER, JSON.stringify({ id, at: manifest.createdAt }, null, 2));
  return manifest;
}

export function restore(id) {
  const dir = path.join(DIR, id);
  if (!fs.existsSync(dir)) throw new Error(`快照不存在: ${id}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const name of config.artifacts) {
    const src = path.join(dir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(config.root, name));
  }
  fs.writeFileSync(POINTER, JSON.stringify({ id, at: new Date().toISOString() }, null, 2));
  return manifest;
}

export function recordScores(id, scores, promoted = false) {
  const file = path.join(DIR, id, 'manifest.json');
  if (!fs.existsSync(file)) throw new Error(`快照不存在: ${id}`);
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  manifest.scores = scores;
  manifest.promoted = promoted;
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return manifest;
}

export function lastPassing() {
  const all = listSnapshots().filter((s) => s.promoted === true);
  return all.length ? all[all.length - 1] : null;
}
