function keyOf(col, row) {
  return `${col},${row}`;
}

function parseKey(key) {
  const [col, row] = key.split(",").map(Number);
  return { col, row };
}

function heuristic(a, b) {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

export function findPath(start, goal, isBlocked, cols, rows) {
  if (start.col === goal.col && start.row === goal.row) return [start];
  const startKey = keyOf(start.col, start.row);
  const goalKey = keyOf(goal.col, goal.row);
  const open = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristic(start, goal)]]);

  while (open.size > 0) {
    let currentKey = null;
    let bestF = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const value = fScore.get(key) ?? Number.POSITIVE_INFINITY;
      if (value < bestF) {
        bestF = value;
        currentKey = key;
      }
    }
    if (!currentKey) break;
    if (currentKey === goalKey) {
      const result = [goalKey];
      while (cameFrom.has(result[0])) {
        result.unshift(cameFrom.get(result[0]));
      }
      return result.map(parseKey);
    }
    open.delete(currentKey);
    const { col, row } = parseKey(currentKey);
    const neighbors = [
      { col: col + 1, row },
      { col: col - 1, row },
      { col, row: row + 1 },
      { col, row: row - 1 },
    ];
    for (const next of neighbors) {
      if (next.col < 0 || next.col >= cols || next.row < 0 || next.row >= rows) continue;
      if (isBlocked(next.col, next.row) && keyOf(next.col, next.row) !== goalKey) continue;
      const nextKey = keyOf(next.col, next.row);
      const candidateG = (gScore.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1;
      if (candidateG < (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(nextKey, currentKey);
        gScore.set(nextKey, candidateG);
        fScore.set(nextKey, candidateG + heuristic(next, goal));
        open.add(nextKey);
      }
    }
  }
  return [start];
}
