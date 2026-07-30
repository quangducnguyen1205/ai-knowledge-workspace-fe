/** Joins conditional class names, dropping falsy entries. */
export function joinClassNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
