package com.puzzle.solver;

import java.util.*;

public class AStarSolver {

    private static class Node {
        int[] board;
        int blankIdx;
        int g; // cost so far
        int h; // heuristic cost
        Node parent;

        public Node(int[] board, int blankIdx, int g, int h, Node parent) {
            this.board = board;
            this.blankIdx = blankIdx;
            this.g = g;
            this.h = h;
            this.parent = parent;
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Node node = (Node) o;
            return Arrays.equals(board, node.board);
        }

        @Override
        public int hashCode() {
            return Arrays.hashCode(board);
        }
    }

    private static int calculateManhattan(int[] board, int size) {
        int dist = 0;
        int linearConflict = 0;

        for (int i = 0; i < board.length; i++) {
            int val = board[i];
            if (val != 0) {
                int targetIdx = val - 1;
                int targetX = targetIdx % size;
                int targetY = targetIdx / size;
                int currentX = i % size;
                int currentY = i / size;
                dist += Math.abs(currentX - targetX) + Math.abs(currentY - targetY);
            }
        }

        // Add Linear Conflict for much faster heuristic resolution (crucial for 5x5 and larger)
        // Row conflicts
        for (int row = 0; row < size; row++) {
            for (int col1 = 0; col1 < size; col1++) {
                int val1 = board[row * size + col1];
                if (val1 == 0) continue;
                int targetY1 = (val1 - 1) / size;
                if (targetY1 == row) {
                    for (int col2 = col1 + 1; col2 < size; col2++) {
                        int val2 = board[row * size + col2];
                        if (val2 == 0) continue;
                        int targetY2 = (val2 - 1) / size;
                        if (targetY2 == row && val1 > val2) {
                            linearConflict += 2;
                        }
                    }
                }
            }
        }

        // Column conflicts
        for (int col = 0; col < size; col++) {
            for (int row1 = 0; row1 < size; row1++) {
                int val1 = board[row1 * size + col];
                if (val1 == 0) continue;
                int targetX1 = (val1 - 1) % size;
                if (targetX1 == col) {
                    for (int row2 = row1 + 1; row2 < size; row2++) {
                        int val2 = board[row2 * size + col];
                        if (val2 == 0) continue;
                        int targetX2 = (val2 - 1) % size;
                        if (targetX2 == col && val1 > val2) {
                            linearConflict += 2;
                        }
                    }
                }
            }
        }

        return dist + linearConflict;
    }

    public static List<int[]> solve(int[] initialBoard, int size) {
        boolean useAStar = size <= 3; // 3x3 uses A*, 4x4 uses GBFS
        
        int n = size * size;
        int startBlank = -1;
        for (int i = 0; i < n; i++) {
            if (initialBoard[i] == 0) {
                startBlank = i;
                break;
            }
        }

        Node startNode = new Node(initialBoard.clone(), startBlank, 0, calculateManhattan(initialBoard, size), null);

        PriorityQueue<Node> openSet = new PriorityQueue<>((a, b) -> {
            if (useAStar) {
                // A* Search: f(n) = g(n) + h(n). Tie-break with lower h to reach goal faster.
                int fA = a.g + a.h;
                int fB = b.g + b.h;
                if (fA == fB) return Integer.compare(a.h, b.h);
                return Integer.compare(fA, fB);
            } else {
                // Greedy Best-First Search: f(n) = h(n). Tie-break with higher g to dive deeper.
                if (a.h == b.h) return Integer.compare(b.g, a.g);
                return Integer.compare(a.h, b.h);
            }
        });
        Set<Node> closedSet = new HashSet<>();

        openSet.add(startNode);

        int[] dx = {-1, 1, 0, 0};
        int[] dy = {0, 0, -1, 1};

        int maxIterations = 600000; // Increased limit for larger grids using GBFS
        int iterations = 0;

        while (!openSet.isEmpty() && iterations < maxIterations) {
            iterations++;
            Node current = openSet.poll();

            if (current.h == 0) {
                // Solved
                List<int[]> path = new ArrayList<>();
                while (current != null) {
                    path.add(current.board);
                    current = current.parent;
                }
                Collections.reverse(path);
                return path;
            }

            closedSet.add(current);

            int x = current.blankIdx % size;
            int y = current.blankIdx / size;

            for (int i = 0; i < 4; i++) {
                int nx = x + dx[i];
                int ny = y + dy[i];

                if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                    int nIdx = ny * size + nx;
                    int[] newBoard = current.board.clone();
                    newBoard[current.blankIdx] = newBoard[nIdx];
                    newBoard[nIdx] = 0;

                    Node neighbor = new Node(newBoard, nIdx, current.g + 1, calculateManhattan(newBoard, size), current);

                    if (!closedSet.contains(neighbor)) {
                        // For pure A*, we should technically check if it's in openSet with a higher g cost.
                        // Here we use a simpler approach which is usually fine for these puzzles
                        openSet.add(neighbor);
                    }
                }
            }
        }

        return new ArrayList<>(); // Return empty if no solution found within limits
    }
}
