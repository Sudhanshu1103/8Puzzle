package com.puzzle.generator;

import java.util.*;

public class PuzzleGenerator {

    public static int[] generate(int size){

        int n = size*size;

        int[] board = new int[n];

        for(int i=0;i<n-1;i++)
            board[i]=i+1;
        board[n-1] = 0;

        Random rand = new Random();

        for(int i=n-1;i>0;i--){

            int j = rand.nextInt(i+1);

            int temp = board[i];
            board[i] = board[j];
            board[j] = temp;
        }

        if (!isSolvable(board, size)) {
            makeSolvable(board);
        }

        return board;
    }

    private static boolean isSolvable(int[] board, int size) {
        int inversions = 0;
        int blankRowFromBottom = 0;

        for (int i = 0; i < board.length; i++) {
            if (board[i] == 0) {
                blankRowFromBottom = size - (i / size);
                continue;
            }
            for (int j = i + 1; j < board.length; j++) {
                if (board[j] != 0 && board[i] > board[j]) {
                    inversions++;
                }
            }
        }

        if (size % 2 != 0) { // odd sizes like 3x3, 5x5
            return inversions % 2 == 0;
        } else { // even sizes like 4x4, 6x6
            if (blankRowFromBottom % 2 == 0) {
                return inversions % 2 != 0;
            } else {
                return inversions % 2 == 0;
            }
        }
    }

    private static void makeSolvable(int[] board) {
        // Swap first two non-blank tiles. This guarantees a parity change in inversions
        int t1 = -1, t2 = -1;
        for (int i = 0; i < board.length; i++) {
            if (board[i] != 0) {
                if (t1 == -1) {
                    t1 = i;
                } else if (t2 == -1) {
                    t2 = i;
                    break;
                }
            }
        }
        int temp = board[t1];
        board[t1] = board[t2];
        board[t2] = temp;
    }

}