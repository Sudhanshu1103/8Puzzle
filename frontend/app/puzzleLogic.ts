class Node {
  constructor(
    public board: number[],
    public blankIdx: number,
    public g: number,
    public h: number,
    public parent: Node | null
  ) {}
}

class PriorityQueue {
  private heap: Node[] = [];

  constructor(private compare: (a: Node, b: Node) => number) {}

  push(node: Node) {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): Node | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const result = this.heap[0];
    this.heap[0] = this.heap.pop() as Node;
    this.bubbleDown(0);
    return result;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIdx]) >= 0) break;
      [this.heap[index], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[index]];
      index = parentIdx;
    }
  }

  private bubbleDown(index: number) {
    const length = this.heap.length;
    while (true) {
      const leftIdx = 2 * index + 1;
      const rightIdx = 2 * index + 2;
      let smallestIdx = index;

      if (leftIdx < length && this.compare(this.heap[leftIdx], this.heap[smallestIdx]) < 0) {
        smallestIdx = leftIdx;
      }
      if (rightIdx < length && this.compare(this.heap[rightIdx], this.heap[smallestIdx]) < 0) {
        smallestIdx = rightIdx;
      }

      if (smallestIdx === index) break;

      [this.heap[index], this.heap[smallestIdx]] = [this.heap[smallestIdx], this.heap[index]];
      index = smallestIdx;
    }
  }
}

function calculateManhattan(board: number[], size: number): number {
  let dist = 0;
  let linearConflict = 0;

  for (let i = 0; i < board.length; i++) {
    const val = board[i];
    if (val !== 0) {
      const targetIdx = val - 1;
      const targetX = targetIdx % size;
      const targetY = Math.floor(targetIdx / size);
      const currentX = i % size;
      const currentY = Math.floor(i / size);
      dist += Math.abs(currentX - targetX) + Math.abs(currentY - targetY);
    }
  }

  for (let row = 0; row < size; row++) {
    for (let col1 = 0; col1 < size; col1++) {
      const val1 = board[row * size + col1];
      if (val1 === 0) continue;
      const targetY1 = Math.floor((val1 - 1) / size);
      if (targetY1 === row) {
        for (let col2 = col1 + 1; col2 < size; col2++) {
          const val2 = board[row * size + col2];
          if (val2 === 0) continue;
          const targetY2 = Math.floor((val2 - 1) / size);
          if (targetY2 === row && val1 > val2) {
            linearConflict += 2;
          }
        }
      }
    }
  }

  for (let col = 0; col < size; col++) {
    for (let row1 = 0; row1 < size; row1++) {
      const val1 = board[row1 * size + col];
      if (val1 === 0) continue;
      const targetX1 = (val1 - 1) % size;
      if (targetX1 === col) {
        for (let row2 = row1 + 1; row2 < size; row2++) {
          const val2 = board[row2 * size + col];
          if (val2 === 0) continue;
          const targetX2 = (val2 - 1) % size;
          if (targetX2 === col && val1 > val2) {
            linearConflict += 2;
          }
        }
      }
    }
  }

  return dist + linearConflict;
}

export function solvePuzzle(initialBoard: number[], size: number): number[][] {
  const useAStar = size <= 3;
  const n = size * size;
  let startBlank = -1;
  for (let i = 0; i < n; i++) {
    if (initialBoard[i] === 0) {
      startBlank = i;
      break;
    }
  }

  const startNode = new Node(
    [...initialBoard],
    startBlank,
    0,
    calculateManhattan(initialBoard, size),
    null
  );

  const openSet = new PriorityQueue((a, b) => {
    if (useAStar) {
      const fA = a.g + a.h;
      const fB = b.g + b.h;
      if (fA === fB) return a.h - b.h;
      return fA - fB;
    } else {
      if (a.h === b.h) return b.g - a.g;
      return a.h - b.h;
    }
  });

  const closedSet = new Set<string>();
  openSet.push(startNode);

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  const maxIterations = 600000;
  let iterations = 0;

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.pop()!;

    if (current.h === 0) {
      const path: number[][] = [];
      let currNode: Node | null = current;
      while (currNode !== null) {
        path.push(currNode.board);
        currNode = currNode.parent;
      }
      return path.reverse();
    }

    const boardString = current.board.join(',');
    if (closedSet.has(boardString)) continue;
    closedSet.add(boardString);

    const x = current.blankIdx % size;
    const y = Math.floor(current.blankIdx / size);

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];

      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const nIdx = ny * size + nx;
        const newBoard = [...current.board];
        newBoard[current.blankIdx] = newBoard[nIdx];
        newBoard[nIdx] = 0;

        const newBoardStr = newBoard.join(',');
        if (!closedSet.has(newBoardStr)) {
          const neighbor = new Node(
            newBoard,
            nIdx,
            current.g + 1,
            calculateManhattan(newBoard, size),
            current
          );
          openSet.push(neighbor);
        }
      }
    }
  }

  return [];
}

export function getHintLocal(initialBoard: number[], size: number): number[][] {
  const n = size * size;
  let startBlank = -1;
  for (let i = 0; i < n; i++) {
    if (initialBoard[i] === 0) {
      startBlank = i;
      break;
    }
  }

  const startNode = new Node(
    [...initialBoard],
    startBlank,
    0,
    calculateManhattan(initialBoard, size),
    null
  );

  const openSet = new PriorityQueue((a, b) => {
    const fA = a.g + a.h;
    const fB = b.g + b.h;
    if (fA === fB) return a.h - b.h;
    return fA - fB;
  });

  const closedSet = new Set<string>();
  openSet.push(startNode);

  const dx = [-1, 1, 0, 0];
  const dy = [0, 0, -1, 1];

  const maxIterations = 2000;
  let iterations = 0;
  let bestNode = startNode;

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.pop()!;

    if (current.h < bestNode.h) {
      bestNode = current;
    }

    if (current.h === 0) {
      bestNode = current;
      break;
    }

    const boardString = current.board.join(',');
    if (closedSet.has(boardString)) continue;
    closedSet.add(boardString);

    const x = current.blankIdx % size;
    const y = Math.floor(current.blankIdx / size);

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];

      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
        const nIdx = ny * size + nx;
        const newBoard = [...current.board];
        newBoard[current.blankIdx] = newBoard[nIdx];
        newBoard[nIdx] = 0;

        const newBoardStr = newBoard.join(',');
        if (!closedSet.has(newBoardStr)) {
          const neighbor = new Node(
            newBoard,
            nIdx,
            current.g + 1,
            calculateManhattan(newBoard, size),
            current
          );
          openSet.push(neighbor);
        }
      }
    }
  }

  let currNode: Node | null = bestNode;
  const path: number[][] = [];
  while (currNode !== null) {
    path.push(currNode.board);
    currNode = currNode.parent;
  }
  
  if (path.length > 1) {
    path.reverse();
    return [initialBoard, path[1]];
  }

  return [];
}

function isSolvable(board: number[], size: number): boolean {
  let inversions = 0;
  let blankRowFromBottom = 0;

  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0) {
      blankRowFromBottom = size - Math.floor(i / size);
      continue;
    }
    for (let j = i + 1; j < board.length; j++) {
      if (board[j] !== 0 && board[i] > board[j]) {
        inversions++;
      }
    }
  }

  if (size % 2 !== 0) {
    return inversions % 2 === 0;
  } else {
    if (blankRowFromBottom % 2 === 0) {
      return inversions % 2 !== 0;
    } else {
      return inversions % 2 === 0;
    }
  }
}

function makeSolvable(board: number[]) {
  let t1 = -1, t2 = -1;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== 0) {
      if (t1 === -1) {
        t1 = i;
      } else if (t2 === -1) {
        t2 = i;
        break;
      }
    }
  }
  const temp = board[t1];
  board[t1] = board[t2];
  board[t2] = temp;
}

export function generatePuzzleLocal(size: number): number[] {
  const n = size * size;
  const board = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) board[i] = i + 1;
  board[n - 1] = 0;

  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = board[i];
    board[i] = board[j];
    board[j] = temp;
  }

  if (!isSolvable(board, size)) {
    makeSolvable(board);
  }
  return board;
}
