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

export function parseMetafields(metafields: any[]): BookMetafields {
  const result: BookMetafields = {};

  for (const mf of metafields || []) {
    if (!mf) continue;
    const { key, value, type } = mf;

    if (type?.startsWith('list.')) {
      try {
        result[key as keyof BookMetafields] = JSON.parse(value);
      } catch {
        result[key as keyof BookMetafields] = value;
      }
    } else {
      result[key as keyof BookMetafields] = value;
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
