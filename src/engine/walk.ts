/** Aplica `fn` em toda string do objeto (as imagens podem estar em qualquer nível do AdData). */
export function mapStrings<T>(value: T, fn: (s: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)])) as T;
  }
  return value;
}

/** Todas as strings do objeto que satisfazem `test`, sem repetição. */
export function collectStrings(value: unknown, test: (s: string) => boolean, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (test(value)) out.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, test, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, test, out));
  return out;
}
