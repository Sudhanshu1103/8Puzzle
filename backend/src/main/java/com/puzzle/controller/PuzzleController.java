package com.puzzle.controller;

import org.springframework.web.bind.annotation.*;
import java.util.*;

import com.puzzle.service.PuzzleService;

@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/puzzle")
public class PuzzleController {

    @PostMapping("/generate")
    public Map<String,int[]> generate(@RequestBody Map<String,Integer> req){

        int size = req.get("size");

        int[] board = PuzzleService.generatePuzzle(size);

        Map<String,int[]> res = new HashMap<>();
        res.put("board",board);

        return res;
    }

    @PostMapping("/solve")
    public Map<String, Object> solve(@RequestBody Map<String, Object> req) {
        int size = (Integer) req.get("size");
        
        @SuppressWarnings("unchecked")
        List<Integer> boardList = (List<Integer>) req.get("board");
        int[] board = new int[boardList.size()];
        for(int i = 0; i < boardList.size(); i++) {
            board[i] = boardList.get(i);
        }

        List<int[]> solution = PuzzleService.solvePuzzle(board, size);

        Map<String, Object> res = new HashMap<>();
        res.put("solution", solution);
        res.put("steps", solution.size() > 0 ? solution.size() - 1 : 0);
        res.put("solvable", !solution.isEmpty());

        return res;
    }

}