/** Adds or removes a thread key without duplicating it or reordering the rest. */
export function withConversationThread(
  keys: ReadonlyArray<string>,
  key: string,
  enabled: boolean,
): ReadonlyArray<string> {
  const present = keys.includes(key);
  if (enabled) return present ? keys : [...keys, key];
  return present ? keys.filter((candidate) => candidate !== key) : keys;
}
