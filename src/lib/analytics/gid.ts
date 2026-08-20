export interface ParsedGid {
  id: string;
  resource: string | null;
  resourceId: string | null;
  search: string;
  searchParams: URLSearchParams;
  hash: string;
}

export function parseGid(gid: string | undefined | null): ParsedGid {
  const defaultReturn: ParsedGid = {
    id: '',
    resource: null,
    resourceId: null,
    search: '',
    searchParams: new URLSearchParams(),
    hash: '',
  };

  if (typeof gid !== 'string' || !gid) {
    return defaultReturn;
  }

  try {
    const { search, searchParams, pathname, hash } = new URL(gid);
    const pathnameParts = pathname.split('/').filter(Boolean);
    const resourcePart = pathnameParts[pathnameParts.length - 2];
    const lastPathnamePart = pathnameParts[pathnameParts.length - 1];

    if (!resourcePart || !lastPathnamePart) {
      return defaultReturn;
    }

    return {
      id: `${lastPathnamePart}${search}${hash}`,
      resourceId: lastPathnamePart,
      resource: resourcePart,
      search,
      searchParams,
      hash,
    };
  } catch {
    return defaultReturn;
  }
}
