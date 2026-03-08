package com.puzzle.service;

import com.puzzle.generator.PuzzleGenerator;
import com.puzzle.solver.AStarSolver;
import java.util.List;

public class PuzzleService {

    public static int[] generatePuzzle(int size){

        return PuzzleGenerator.generate(size);

    }

    public static List<int[]> solvePuzzle(int[] board, int size) {
        return AStarSolver.solve(board, size);
    }

}