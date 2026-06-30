export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  items.forEach((item) => {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  });
  return groups;
}
