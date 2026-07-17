export interface BookMetafields {
  cover_palette?: string;
  genre?: string;
  authors?: string[];
  publisher?: string;
  year?: string;
  binding?: string;
  pages?: string;
  provenance?: string;
}

/* Some keys differ between the source (app-ibp-book) namespace and the
   shape the storefront expects. */
const KEY_ALIASES: Record<string, keyof BookMetafields> = {
  publication_year: 'year',
};

export function parseMetafields(metafields: any[]): BookMetafields {
  const result: BookMetafields = {};

  for (const mf of metafields || []) {
    if (!mf) continue;
    const { value, type } = mf;
    const key = (KEY_ALIASES[mf.key] ?? mf.key) as keyof BookMetafields;

    if (type?.startsWith('list.')) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function getMetafield(metafields: any[], key: string): any {
  const mf = metafields?.find((m) => m?.key === key);
  if (!mf) return undefined;
  if (mf.type?.startsWith('list.')) {
    try {
      return JSON.parse(mf.value);
    } catch {
      return mf.value;
    }
  }
  return mf.value;
}
