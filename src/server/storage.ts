// Server persistence (D-016): a storage interface the server owns. The
// browser's local storage is NEVER the source of truth for online characters.
// FileStorage (atomic tmp+rename writes) backs the first milestone; the
// interface is the seam a database provider implements later.

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export interface StorageProvider {
  loadAuth(): string | null;
  saveAuth(json: string): void;
  loadCharacter(charId: string): string | null;
  saveCharacter(charId: string, json: string): void;
  loadWorld(): string | null;
  saveWorld(json: string): void;
}

/** In-memory provider for tests. */
export class MemoryStorage implements StorageProvider {
  auth: string | null = null;
  characters = new Map<string, string>();
  world: string | null = null;

  loadAuth(): string | null {
    return this.auth;
  }

  saveAuth(json: string): void {
    this.auth = json;
  }

  loadCharacter(charId: string): string | null {
    return this.characters.get(charId) ?? null;
  }

  saveCharacter(charId: string, json: string): void {
    this.characters.set(charId, json);
  }

  loadWorld(): string | null {
    return this.world;
  }

  saveWorld(json: string): void {
    this.world = json;
  }
}

/** File-backed provider with atomic writes (write tmp, rename over). */
export class FileStorage implements StorageProvider {
  constructor(private dir: string) {
    mkdirSync(join(dir, 'characters'), { recursive: true });
  }

  private atomicWrite(path: string, data: string, privateFile = false): void {
    const tmp = path + '.tmp';
    writeFileSync(tmp, data, { encoding: 'utf8', mode: privateFile ? 0o600 : 0o644 });
    try {
      renameSync(tmp, path);
    } catch (err) {
      // Some filesystems forbid rename-over; fall back to direct write.
      writeFileSync(path, data, 'utf8');
      try {
        unlinkSync(tmp);
      } catch {
        /* tmp cleanup best-effort */
      }
      void err;
    }
    if (privateFile) {
      try {
        chmodSync(path, 0o600);
      } catch {
        // Windows and some mounted filesystems do not expose POSIX modes.
      }
    }
  }

  private charPath(charId: string): string {
    // charId is validated by the protocol layer ([a-zA-Z0-9_-]+): safe as a
    // file name component.
    return join(this.dir, 'characters', `${charId}.json`);
  }

  loadAuth(): string | null {
    const path = join(this.dir, 'auth.json');
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  }

  saveAuth(json: string): void {
    this.atomicWrite(join(this.dir, 'auth.json'), json, true);
  }

  loadCharacter(charId: string): string | null {
    const path = this.charPath(charId);
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  }

  saveCharacter(charId: string, json: string): void {
    this.atomicWrite(this.charPath(charId), json);
  }

  loadWorld(): string | null {
    const path = join(this.dir, 'world.json');
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf8');
  }

  saveWorld(json: string): void {
    this.atomicWrite(join(this.dir, 'world.json'), json);
  }
}
