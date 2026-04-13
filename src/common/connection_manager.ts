/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  Connection,
  ConnectionConfigEntry,
  LookupConnection,
  MalloyConfig,
  URLReader,
  discoverConfig,
  contextOverlay,
  getRegisteredConnectionTypes,
} from '@malloydata/malloy';
import type {ConfigOverlays, Overlay} from '@malloydata/malloy'; // eslint-disable-line no-duplicate-imports
import {UnresolvedConnectionConfigEntry} from './types/connection_manager_types';
import {ConnectionFactory} from './connections/types';

export type SecretResolver = (key: string) => Promise<string | undefined>;

/**
 * Storage convention for settings-connection secrets:
 * `connections.<id>.<fieldName>`. The `<id>` is typically a UUID but
 * legacy-migrated entries may use the connection's name instead (see
 * `connection_migration.ts` — `entry.id ?? name`), and connection names
 * have never been restricted — they may contain spaces, unicode, etc.
 * So the id segment accepts anything short of the `.` delimiter. The
 * `connections.` prefix is the real boundary: it stops the overlay from
 * being coaxed into reading unrelated VS Code secrets.
 */
const SECRET_KEY_PATTERN = /^connections\.[^.]+\.[A-Za-z_][A-Za-z0-9_]*$/;

export function isSecretKeyReference(
  value: unknown
): value is {secretKey: string} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'secretKey' in value &&
    typeof (value as Record<string, unknown>)['secretKey'] === 'string'
  );
}

/**
 * Translate settings entries into a POJO suitable for MalloyConfig.
 * Converts VS Code's internal `{secretKey: "..."}` storage shape into
 * the standard `{secret: "..."}` overlay-reference shape, so the `secret`
 * overlay resolves them the same way malloy-config.json references do.
 */
function translateSettingsEntries(
  settings: Record<string, UnresolvedConnectionConfigEntry>
): Record<string, ConnectionConfigEntry> {
  const out: Record<string, ConnectionConfigEntry> = {};
  for (const [name, entry] of Object.entries(settings)) {
    const translated: ConnectionConfigEntry = {is: entry.is};
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'is') continue;
      if (isSecretKeyReference(v)) {
        translated[k] = {secret: v.secretKey};
      } else {
        translated[k] = v;
      }
    }
    out[name] = translated;
  }
  return out;
}

/**
 * Host-specific operations that differ between Node and browser.
 */
export interface HostAdapter {
  /** Expand ~ to home directory. Node: os.homedir(); browser: undefined. */
  expandHome?(path: string): string;
  /** Convert a filesystem path to a file:// URL. Node: url.pathToFileURL(); browser: undefined. */
  pathToFileURL?(path: string): URL;
}

interface CachedConfig {
  config: MalloyConfig;
  source: 'discovered' | 'global' | 'defaults';
  configURL?: URL;
}

/**
 * Returns true if `ancestor` is a prefix of (or equal to) `descendant` in URL space.
 */
function isAncestor(ancestor: URL, descendant: URL): boolean {
  const a = ancestor.toString();
  const d = descendant.toString();
  return d === a || d.startsWith(a.endsWith('/') ? a : a + '/');
}

export class CommonConnectionManager {
  currentRowLimit = 50;
  private workspaceRoots: URL[] = [];
  private globalConfigDirectory = '';
  private secretResolver: SecretResolver | undefined;
  private urlReader: URLReader | undefined;
  private hostAdapter: HostAdapter;

  /** New-format settings config (for tree view / config manager). */
  private settingsConfig:
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined;

  /** Config cache: identity-key → CachedConfig */
  private configCache = new Map<string, CachedConfig>();
  /** Fast-path index: file-directory URL → config-cache key */
  private directoryIndex = new Map<string, string>();

  constructor(
    private connectionFactory: ConnectionFactory,
    hostAdapter?: HostAdapter
  ) {
    this.hostAdapter = hostAdapter ?? {};
  }

  public setURLReader(reader: URLReader): void {
    this.urlReader = reader;
    this.invalidateCache();
  }

  public setGlobalConfigDirectory(dir: string): void {
    if (this.globalConfigDirectory !== dir) {
      this.globalConfigDirectory = dir;
      this.invalidateCache();
    }
  }

  public setSecretResolver(resolver: SecretResolver): void {
    this.secretResolver = resolver;
  }

  public setWorkspaceRoots(roots: (URL | string)[]): void {
    this.workspaceRoots = roots.map(r =>
      typeof r === 'string' ? new URL(r.endsWith('/') ? r : r + '/') : r
    );
    this.invalidateCache();
  }

  public setCurrentRowLimit(rowLimit: number): void {
    this.currentRowLimit = rowLimit;
  }

  public getCurrentRowLimit(): number | undefined {
    return this.currentRowLimit;
  }

  /**
   * Returns the new-format connections config, if settings are in the new
   * format. Used by the tree view and config manager.
   */
  public getNewFormatConfig():
    | Record<string, UnresolvedConnectionConfigEntry>
    | undefined {
    return this.settingsConfig;
  }

  public setConnectionsConfig(
    connectionsConfig: Record<string, UnresolvedConnectionConfigEntry>
  ): void {
    this.settingsConfig = connectionsConfig;
    this.invalidateCache();
  }

  /**
   * Notify that a config file has changed. Clears all cached configs.
   */
  public notifyConfigFileChanged(): void {
    this.invalidateCache();
  }

  public async getConnectionLookup(
    fileURL: URL
  ): Promise<LookupConnection<Connection>> {
    const entry = await this.resolveConfigForFile(fileURL);
    return entry.config.connections;
  }

  public async getConfigForFile(fileURL: URL): Promise<MalloyConfig> {
    const entry = await this.resolveConfigForFile(fileURL);
    return entry.config;
  }

  /**
   * Returns the effective config source for a file. Used by the sidebar
   * to avoid reimplementing discovery.
   */
  public async getEffectiveConfigSource(fileURL: URL): Promise<{
    source: 'discovered' | 'global' | 'defaults';
    configFileUri?: string;
  }> {
    const entry = await this.resolveConfigForFile(fileURL);
    return {
      source: entry.source,
      configFileUri: entry.configURL?.toString(),
    };
  }

  // --- Private implementation ---

  private invalidateCache(): void {
    for (const entry of this.configCache.values()) {
      entry.config.releaseConnections().catch(err => {
        console.warn('Error releasing config connections:', err);
      });
    }
    this.configCache.clear();
    this.directoryIndex.clear();
  }

  private workspaceFolderFor(fileURL: URL): URL {
    // Pick the longest matching workspaceRoot prefix.
    const candidates = this.workspaceRoots
      .filter(r => isAncestor(r, fileURL))
      .sort((a, b) => b.toString().length - a.toString().length);
    // Fall back to the file's parent directory for files outside any workspace.
    return candidates[0] ?? new URL('.', fileURL);
  }

  private async resolveConfigForFile(fileURL: URL): Promise<CachedConfig> {
    const workspaceFolder = this.workspaceFolderFor(fileURL);
    const fileDir = new URL('.', fileURL).toString();

    // Fast path: check directory index
    const indexedKey = this.directoryIndex.get(fileDir);
    if (indexedKey !== undefined) {
      const cached = this.configCache.get(indexedKey);
      if (cached) return cached;
      // Index entry stale — clear it and re-resolve
      this.directoryIndex.delete(fileDir);
    }

    // Level 1 — discovery (project config)
    const discovered = await this.tryDiscovery(fileURL, workspaceFolder);
    if (discovered) {
      // Cache key by config identity: manifestURL distinguishes different
      // config files within the same workspace (nested configs).
      const identityKey = `discovered:${workspaceFolder}:${
        discovered.configURL?.toString() ?? ''
      }`;

      const existing = this.configCache.get(identityKey);
      if (existing) {
        this.directoryIndex.set(fileDir, identityKey);
        return existing;
      }

      this.applyWrappers(discovered.config, {workspaceFolder});
      const entry: CachedConfig = {
        config: discovered.config,
        source: 'discovered',
        configURL: discovered.configURL,
      };
      this.configCache.set(identityKey, entry);
      this.directoryIndex.set(fileDir, identityKey);
      return entry;
    }

    // Levels 2 & 3 don't vary by file within a workspace — key by folder.
    const fallbackKey = `fallback:${workspaceFolder}`;
    const existingFallback = this.configCache.get(fallbackKey);
    if (existingFallback) {
      this.directoryIndex.set(fileDir, fallbackKey);
      return existingFallback;
    }

    // Level 2 — global config
    if (this.globalConfigDirectory) {
      const global = await this.tryGlobalConfig(workspaceFolder);
      if (global) {
        this.applyWrappers(global.config, {workspaceFolder});
        const entry: CachedConfig = {
          config: global.config,
          source: 'global',
          configURL: global.configURL,
        };
        this.configCache.set(fallbackKey, entry);
        this.directoryIndex.set(fileDir, fallbackKey);
        return entry;
      }
    }

    // Level 3 — settings + defaults
    const built = this.buildSettingsAndDefaultsConfig(workspaceFolder);
    this.applyWrappers(built.config, {workspaceFolder});
    const entry: CachedConfig = {
      config: built.config,
      source: 'defaults',
    };
    this.configCache.set(fallbackKey, entry);
    this.directoryIndex.set(fileDir, fallbackKey);
    return entry;
  }

  private async tryDiscovery(
    fileURL: URL,
    workspaceFolder: URL
  ): Promise<{config: MalloyConfig; configURL?: URL} | undefined> {
    if (!this.urlReader) return undefined;
    try {
      const config = await discoverConfig(
        fileURL,
        workspaceFolder,
        this.urlReader
      );
      if (!config) return undefined;
      const rawURL = await config.readOverlay('config', 'configURL');
      const configURL =
        typeof rawURL === 'string' ? new URL(rawURL) : undefined;
      return {config, configURL};
    } catch (err) {
      console.warn(`Malloy config discovery failed near ${fileURL}:`, err);
      return undefined;
    }
  }

  /**
   * The `secret` overlay — only wired at level 3, where VS Code
   * translates stored settings entries into a MalloyConfig POJO. Shared
   * malloy-config.json files must not have this overlay in scope, for
   * two reasons:
   *
   * 1. Portability — a config that references SecretStorage wouldn't
   *    work under the CLI or Publisher.
   * 2. Exfiltration — a committed config could reference an arbitrary
   *    secret key as any connection property (e.g. `host: {secret: ...}`),
   *    turning the config file into a channel that reads secrets out to
   *    wherever that property ends up (network, logs, UI).
   *
   * Returns `undefined` if no secret resolver has been installed.
   */
  private secretOverlay(): Overlay | undefined {
    const resolver = this.secretResolver;
    if (!resolver) return undefined;
    return async (path: string[]) => {
      // Only resolve single-segment paths matching the storage convention
      // used by the connection editor: `connections.<id>.<fieldName>`.
      // Any other shape (multi-segment path, non-matching key) silently
      // returns undefined — the reference drops like any other overlay
      // miss, and an attacker can't coax the overlay into reading an
      // unrelated VS Code secret.
      if (path.length !== 1) return undefined;
      if (!SECRET_KEY_PATTERN.test(path[0])) return undefined;
      return await resolver(path[0]);
    };
  }

  private async tryGlobalConfig(
    workspaceFolder: URL
  ): Promise<{config: MalloyConfig; configURL?: URL} | undefined> {
    if (!this.urlReader) return undefined;
    if (!this.hostAdapter.expandHome || !this.hostAdapter.pathToFileURL) {
      return undefined;
    }

    const expandedDir = this.hostAdapter.expandHome(this.globalConfigDirectory);
    if (!expandedDir) return undefined;

    // Convert the filesystem path to a proper file:// URL via the host adapter.
    // This handles Windows drive letters, spaces, and other characters correctly.
    let dirUrl = this.hostAdapter.pathToFileURL(
      expandedDir.endsWith('/') || expandedDir.endsWith('\\')
        ? expandedDir
        : expandedDir + '/'
    );
    // Ensure trailing slash for directory URL
    if (!dirUrl.href.endsWith('/')) {
      dirUrl = new URL(dirUrl.href + '/');
    }
    const globalConfigURL = new URL('malloy-config.json', dirUrl);

    let text: string;
    try {
      const result = await this.urlReader.readURL(globalConfigURL);
      text = typeof result === 'string' ? result : result.contents;
    } catch {
      return undefined;
    }

    let pojo: object;
    try {
      pojo = JSON.parse(text);
    } catch (err) {
      console.warn(
        `Malloy global config invalid JSON at ${globalConfigURL}:`,
        err
      );
      return undefined;
    }

    const overlays: ConfigOverlays = {
      config: contextOverlay({
        rootDirectory: workspaceFolder.toString(),
        configURL: globalConfigURL.toString(),
      }),
    };
    return {
      config: new MalloyConfig(pojo, overlays),
      configURL: globalConfigURL,
    };
  }

  private buildSettingsAndDefaultsConfig(workspaceFolder: URL): {
    config: MalloyConfig;
    configURL?: undefined;
  } {
    const overlays: ConfigOverlays = {
      config: contextOverlay({
        rootDirectory: workspaceFolder.toString(),
      }),
    };
    const secret = this.secretOverlay();
    if (secret) overlays['secret'] = secret;
    const pojo: {
      includeDefaultConnections: boolean;
      connections?: Record<string, ConnectionConfigEntry>;
    } = {includeDefaultConnections: true};
    if (this.settingsConfig) {
      pojo.connections = translateSettingsEntries(this.settingsConfig);
    }
    const config = new MalloyConfig(pojo, overlays);
    return {config};
  }

  private applyWrappers(
    config: MalloyConfig,
    opts: {workspaceFolder: URL}
  ): void {
    const postProcess = this.connectionFactory.postProcessConnection?.bind(
      this.connectionFactory
    );
    if (postProcess) {
      const workingDir = opts.workspaceFolder.toString();
      config.wrapConnections(base => ({
        lookupConnection: async (name: string): Promise<Connection> => {
          const conn = await base.lookupConnection(name);
          postProcess(conn, workingDir);
          return conn;
        },
      }));
    }
  }

  /**
   * Build default connections info from the registry. Used by the
   * getConnectionTypeInfo handler to populate the sidebar.
   */
  static getDefaultConnectionTypes(): Record<string, string> {
    const registeredTypes = getRegisteredConnectionTypes();

    // Browser: only duckdb_wasm is available — alias it as 'duckdb'
    if (
      registeredTypes.includes('duckdb_wasm') &&
      !registeredTypes.includes('duckdb')
    ) {
      return {duckdb: 'duckdb_wasm'};
    }

    // Node: one entry per registered type + md (MotherDuck) alias
    const defaults: Record<string, string> = {};
    for (const typeName of registeredTypes) {
      defaults[typeName] = typeName;
    }
    defaults['md'] = 'duckdb';
    return defaults;
  }
}
