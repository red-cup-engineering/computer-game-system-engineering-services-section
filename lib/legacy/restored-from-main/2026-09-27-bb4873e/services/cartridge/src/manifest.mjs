/**
 * manifest.mjs — the CartridgeManifest schema and its hand-rolled validator.
 *
 * One manifest per playable entry (spec §1.1). No validation library is used, per house
 * convention (zero runtime dependencies beyond pinned @561-group/* packages) — this module
 * is the entire schema surface for `play.561.group`'s catalog build and for any game
 * checking its own manifest before publishing it.
 *
 * `validateManifest` never throws; it collects every error found and reports them together,
 * because a manifest author fixing one field at a time against a fail-fast validator is a
 * needlessly slow loop. `assertManifest` is the throwing convenience wrapper for call sites
 * that want to fail hard.
 *
 * Type shapes (`CartridgeManifest`, `CartridgeConfig`, `SeedPolicy`, `ValidationResult`) are
 * declared in the co-located manifest.d.ts, not here — this file is plain JavaScript, no
 * TypeScript syntax, so it loads correctly whether run directly or imported from inside a
 * consumer's node_modules (Node's type-stripping is unavailable for files under
 * node_modules, which is why this package ships .mjs rather than .mts as its runtime
 * source).
 */

const SEED_POLICY_KINDS = new Set(['daily-utc', 'on-demand', 'client-supplied']);

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNonEmptyString(x) {
  return typeof x === 'string' && x.length > 0;
}

/** `id`/`subdomain` are URL-path/host-safe: lowercase letters, digits, and hyphens, must
 *  start and end with an alphanumeric. This is deliberately the same shape a DNS label or a
 *  URL path segment requires, since both `manifest.subdomain` (`<subdomain>.561.group`) and
 *  `manifest.id` (catalog routing) are used that way downstream. */
const URL_SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateConfig(config, where, errors) {
  if (!isPlainObject(config)) {
    errors.push(`${where}: must be an object`);
    return;
  }
  if (!isNonEmptyString(config.id)) {
    errors.push(`${where}.id: must be a non-empty string`);
  }
  if (!isNonEmptyString(config.displayName)) {
    errors.push(`${where}.displayName: must be a non-empty string`);
  }
  if (!isPlainObject(config.params)) {
    errors.push(`${where}.params: must be an object`);
  }
}

export function validateManifest(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    return { valid: false, errors: ['manifest must be an object'] };
  }

  if (!isNonEmptyString(data.id)) {
    errors.push('id: must be a non-empty string');
  } else if (!URL_SAFE_ID.test(data.id)) {
    errors.push(`id: "${data.id}" must be URL-safe (lowercase alphanumeric segments joined by hyphens)`);
  }

  if (!isNonEmptyString(data.displayName)) {
    errors.push('displayName: must be a non-empty string');
  }

  if (!isNonEmptyString(data.description)) {
    errors.push('description: must be a non-empty string');
  }

  if (!isNonEmptyString(data.subdomain)) {
    errors.push('subdomain: must be a non-empty string');
  } else if (!URL_SAFE_ID.test(data.subdomain)) {
    errors.push(`subdomain: "${data.subdomain}" must be URL-safe (lowercase alphanumeric segments joined by hyphens)`);
  }

  if (data.configs !== undefined) {
    if (!Array.isArray(data.configs)) {
      errors.push('configs: when present, must be an array');
    } else {
      data.configs.forEach((config, index) => validateConfig(config, `configs[${index}]`, errors));
      const ids = data.configs
        .filter(isPlainObject)
        .map((c) => c.id)
        .filter((id) => typeof id === 'string');
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) errors.push(`configs: duplicate config id "${id}"`);
        seen.add(id);
      }
    }
  }

  if (!isPlainObject(data.entryPoints)) {
    errors.push('entryPoints: must be an object');
  } else {
    const { browser, headless } = data.entryPoints;
    if (browser !== undefined && !isNonEmptyString(browser)) {
      errors.push('entryPoints.browser: when present, must be a non-empty string');
    }
    if (headless !== undefined && !isNonEmptyString(headless)) {
      errors.push('entryPoints.headless: when present, must be a non-empty string');
    }
    if (browser === undefined && headless === undefined) {
      errors.push('entryPoints: at least one of browser or headless must be present');
    }
  }

  if (!isPlainObject(data.seedPolicy)) {
    errors.push('seedPolicy: must be an object');
  } else if (!SEED_POLICY_KINDS.has(data.seedPolicy.kind)) {
    errors.push(`seedPolicy.kind: must be one of daily-utc, on-demand, client-supplied (got ${JSON.stringify(data.seedPolicy.kind)})`);
  }

  if (!isPlainObject(data.intentLog)) {
    errors.push('intentLog: must be an object');
  } else {
    if (!isNonEmptyString(data.intentLog.schemaVersion)) {
      errors.push('intentLog.schemaVersion: must be a non-empty string');
    }
    if (data.intentLog.schemaRef !== undefined && !isNonEmptyString(data.intentLog.schemaRef)) {
      errors.push('intentLog.schemaRef: when present, must be a non-empty string');
    }
  }

  if (!isNonEmptyString(data.replayVerifier)) {
    errors.push('replayVerifier: must be a non-empty string');
  }

  if (data.energy !== undefined) {
    if (!isPlainObject(data.energy)) {
      errors.push('energy: when present, must be an object');
    } else {
      if (!isNonEmptyString(data.energy.hooksRef)) {
        errors.push('energy.hooksRef: must be a non-empty string');
      }
      if (!isNonEmptyString(data.energy.accountNamespace)) {
        errors.push('energy.accountNamespace: must be a non-empty string');
      }
    }
  }

  if (!Array.isArray(data.keywords)) {
    errors.push('keywords: must be an array');
  } else if (!data.keywords.every((k) => typeof k === 'string')) {
    errors.push('keywords: every entry must be a string');
  }

  return { valid: errors.length === 0, errors };
}

export function isCartridgeManifest(data) {
  return validateManifest(data).valid;
}

/** Throwing convenience wrapper: validates `data` and throws a single `TypeError` joining
 *  every error found, or returns `data` narrowed to `CartridgeManifest` on success. */
export function assertManifest(data) {
  const result = validateManifest(data);
  if (!result.valid) {
    throw new TypeError(`invalid CartridgeManifest:\n  ${result.errors.join('\n  ')}`);
  }
  return data;
}
