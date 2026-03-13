import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withTiming, Easing, useSharedValue, withSequence, runOnJS } from 'react-native-reanimated';

import { generatePuzzleLocal, solvePuzzle as solvePuzzleLocal, getHintLocal } from './puzzleLogic';

// Expose duration variable to control the sliding transition speed (in milliseconds)
const SLIDE_DURATION_MS = 75; 

// A distinct component for each animated tile so we can manage absolute positioning internally.
const AnimatedTile = ({ value, index, size, boardDimension, isEmpty }: { value: number, index: number, size: number, boardDimension: number, isEmpty: boolean }) => {
  const tileSize = (boardDimension - 10) / size;
  
  // X and Y shared values based on Grid Index
  const left = useSharedValue((index % size) * tileSize);
  const top = useSharedValue(Math.floor(index / size) * tileSize);

  // We immediately respond to an "index" change pushed by the parent component by translating the blocks to the new X/Y.
  useEffect(() => {
    const nextLeft = (index % size) * tileSize;
    const nextTop = Math.floor(index / size) * tileSize;
    
    left.value = withTiming(nextLeft, { duration: SLIDE_DURATION_MS, easing: Easing.inOut(Easing.quad) });
    top.value = withTiming(nextTop, { duration: SLIDE_DURATION_MS, easing: Easing.inOut(Easing.quad) });
  }, [index, size, tileSize]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      left: left.value,
      top: top.value,
    };
  });

  return (
    <Animated.View style={[
      styles.tileWrapper, 
      animatedStyle, 
      { width: tileSize, height: tileSize, position: 'absolute' }
    ]}>
      <View style={[styles.tileInner, isEmpty && styles.emptyTile, {width: '100%', height: '100%'}]}>
         {!isEmpty && <Text style={[styles.tileText, size > 5 && {fontSize: 16}]}>{value}</Text>}
      </View>
    </Animated.View>
  );
};

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game' | 'win' | 'ai_win' | 'instructions'>('menu');
  const [size, setSize] = useState(3);
  const [board, setBoard] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [solving, setSolving] = useState(false);
  
  const [steps, setSteps] = useState(0);
  const [minSteps, setMinSteps] = useState(0);
  const [time, setTime] = useState(0);
  const [coins, setCoins] = useState(0);
  const [aiPath, setAiPath] = useState<number[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, { time: number, steps: number }>>({});

  useEffect(() => {
    const loadCoins = async () => {
      try {
        const storedCoins = await AsyncStorage.getItem('@puzzle_coins');
        if (storedCoins !== null) {
          setCoins(parseInt(storedCoins, 10));
        }
      } catch (e) {
        console.warn('Failed to load coins', e);
      }
    };
    loadCoins();
  }, []);

  const updateCoins = (delta: number) => {
    setCoins((prevCoins) => {
      const newCoins = prevCoins + delta;
      AsyncStorage.setItem('@puzzle_coins', newCoins.toString()).catch(e => console.warn(e));
      return newCoins;
    });
  };

  const sizes = [3, 4, 5, 6, 7, 8];

  // Timer loop
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (screen === 'game' && !solving && !loading) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, solving, loading]);

  const generatePuzzle = async (selectedSize: number) => {
    setLoading(true);
    try {
      // Small timeout to allow UI to show loading indicator
      await new Promise(resolve => setTimeout(resolve, 50));
      const generatedBoard = generatePuzzleLocal(selectedSize);
      
      let computedMinSteps = 0;
      if (selectedSize <= 4) {
        const solution = solvePuzzleLocal(generatedBoard, selectedSize);
        computedMinSteps = solution.length > 1 ? solution.length - 1 : 0;
      }
      setMinSteps(computedMinSteps);

      setBoard(generatedBoard);
      setSteps(0);
      setTime(0);
    } catch (error) {
      console.warn(error);
      Alert.alert('Error', 'Failed to generate puzzle.');
    } finally {
      setLoading(false);
    }
  };

  const startGame = () => {
    setScreen('game');
    generatePuzzle(size);
  };

  const checkWin = (currentBoard: number[]) => {
    if (currentBoard.length === 0) return false;
    for (let i = 0; i < currentBoard.length - 1; i++) {
      if (currentBoard[i] !== i + 1) return false;
    }
    return currentBoard[currentBoard.length - 1] === 0;
  };

  const handleWin = (isAI: boolean, finalSteps: number, computedAiPath: number[] = []) => {
    setTimeout(() => {
      setSolving(false);
      
      const currentScoreKey = `size_${size}`;
      const previousBest = bestScores[currentScoreKey] || { time: Infinity, steps: Infinity };
      const newScore = {
        time: Math.min(previousBest.time, time),
        steps: Math.min(previousBest.steps, finalSteps)
      };
      setBestScores({ ...bestScores, [currentScoreKey]: newScore });

      if (isAI) {
        setAiPath(computedAiPath);
        setScreen('ai_win');
      } else {
        if (finalSteps <= 50) {
          updateCoins(1);
        }
        setScreen('win');
      }
    }, SLIDE_DURATION_MS + 50);
  };

  const solvePuzzle = async () => {
    if (board.length === 0 || solving) return;
    
    const targetSolveMoves = minSteps ? minSteps * 3 : 100;
    
    // For sizes > 4, we only allow hints, which always cost 1 coin.
    const requiresCoin = size > 4 || steps < targetSolveMoves;

    if (requiresCoin && coins < 1) {
      if (size > 4) {
        Alert.alert('Not enough coins', 'You need at least 1 coin to use a hint. Win a match under 50 moves to earn some!');
      } else {
        Alert.alert('Not enough coins', `You need at least 1 coin to use a hint before ${targetSolveMoves} moves. Win a match under 50 moves to earn some!`);
      }
      return;
    }

    setSolving(true);
    
    // Give UI a moment to update the button to "Calculating..." before heavy sync computation
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const solutionPaths = size <= 4 ? solvePuzzleLocal(board, size) : getHintLocal(board, size);
      
      if (solutionPaths.length <= 1) {
        Alert.alert('Info', 'Puzzle is already solved or unsolvable.');
        setSolving(false);
        return;
      }

      if (size > 4 || steps < targetSolveMoves) {
        // HINT MODE: Take only ONE step
        updateCoins(-1);
        setBoard([...solutionPaths[1]]);
        const newSteps = steps + 1;
        setSteps(newSteps);
        
        await new Promise(resolve => setTimeout(resolve, SLIDE_DURATION_MS + 20));
        
        if (checkWin(solutionPaths[1])) {
          handleWin(false, newSteps);
        } else {
          setSolving(false);
        }
      } else {
        // FULL AI SOLVE MODE
        const totalSteps = steps + solutionPaths.length - 1;
        
        // Calculate the AI path (which tiles were moved)
        const computedAiPath: number[] = [];
        for (let i = 1; i < solutionPaths.length; i++) {
          const prevBoard = solutionPaths[i - 1];
          const currBoard = solutionPaths[i];
          const blankIdx = prevBoard.indexOf(0);
          const movedTile = currBoard[blankIdx];
          computedAiPath.push(movedTile);
        }

        // Record best AI score using the user's stats before giving up
        const currentScoreKey = `size_${size}`;
        const previousBest = bestScores[currentScoreKey] || { time: Infinity, steps: Infinity };
        const newScore = {
          time: Math.min(previousBest.time, time),
          steps: Math.min(previousBest.steps, steps) // Don't include AI steps
        };
        setBestScores({ ...bestScores, [currentScoreKey]: newScore });

        // Animate solution
        let finalBoard = board;
        for (let i = 1; i < solutionPaths.length; i++) {
          finalBoard = [...solutionPaths[i]];
          setBoard(finalBoard);
          // Removed setSteps(prev => prev + 1) to keep the user's pre-AI step count
          await new Promise(resolve => setTimeout(resolve, SLIDE_DURATION_MS + 20));
        }
        
        // Pass original user steps to handleWin instead of totalSteps
        handleWin(true, steps, computedAiPath);
      }
      
    } catch (error) {
      Alert.alert('Error', 'Failed to solve.');
      console.warn(error);
      setSolving(false);
    }
  };

  const moveTile = (index: number) => {
    if (solving || board[index] === 0) return;

    const blankIndex = board.indexOf(0);
    const row = Math.floor(index / size);
    const col = index % size;
    const blankRow = Math.floor(blankIndex / size);
    const blankCol = blankIndex % size;

    if (row === blankRow) {
      const newBoard = [...board];
      const stepsToMove = Math.abs(col - blankCol);
      if (col < blankCol) {
        for (let i = blankCol; i > col; i--) newBoard[row * size + i] = newBoard[row * size + i - 1];
      } else {
        for (let i = blankCol; i < col; i++) newBoard[row * size + i] = newBoard[row * size + i + 1];
      }
      newBoard[index] = 0;
      setBoard(newBoard);
      const newSteps = steps + stepsToMove;
      setSteps(newSteps);
      
      if (checkWin(newBoard)) {
        handleWin(false, newSteps);
      }
      
    } else if (col === blankCol) {
      const newBoard = [...board];
      const stepsToMove = Math.abs(row - blankRow);
      if (row < blankRow) {
        for (let i = blankRow; i > row; i--) newBoard[i * size + col] = newBoard[(i - 1) * size + col];
      } else {
        for (let i = blankRow; i < row; i++) newBoard[i * size + col] = newBoard[(i + 1) * size + col];
      }
      newBoard[index] = 0;
      
      setBoard(newBoard);
      const newSteps = steps + stepsToMove;
      setSteps(newSteps);
      
      if (checkWin(newBoard)) {
        handleWin(false, newSteps);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (screen === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuBox}>
          
          <Text style={styles.menuSectionTitle}>Board Size</Text>
          <View style={styles.sizesGrid}>
            {sizes.map(s => (
              <TouchableOpacity key={s} style={styles.sizeRadioRow} onPress={() => setSize(s)}>
                <View style={[styles.radioCircle, size === s && styles.radioActive]}>
                  {size === s && <View style={styles.radioInner} />}
                </View>
                <Text style={styles.radioText}>{s}x{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Classic</Text>
            <Text style={styles.previewSubtitle}>Personal Best: {bestScores[`size_${size}`] ? `${bestScores[`size_${size}`].steps} steps | ${formatTime(bestScores[`size_${size}`].time)}` : 'N/A'}</Text>
          </View>

          <TouchableOpacity style={styles.woodButton} onPress={startGame}>
            <Text style={styles.woodButtonText}>New Game</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.woodButton, { marginTop: 15 }]} onPress={() => setScreen('instructions')}>
            <Text style={styles.woodButtonText}>Instructions</Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'instructions') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ padding: 30, justifyContent: 'center', flexGrow: 1 }}>
          <Text style={{fontSize: 36, fontWeight: '900', color: '#553106', marginBottom: 20, textAlign: 'center'}}>How to Play</Text>
          
          <View style={{backgroundColor: 'rgba(51, 33, 21, 0.1)', padding: 20, borderRadius: 10, marginBottom: 40}}>
            <Text style={{fontSize: 18, color: '#4A3018', marginBottom: 15, lineHeight: 28}}>
              <Text style={{fontWeight: 'bold'}}>Goal:</Text> Arrange the numbers in ascending order from left to right, top to bottom, leaving the empty slot at the very end.
            </Text>
            <Text style={{fontSize: 18, color: '#4A3018', marginBottom: 15, lineHeight: 28}}>
              <Text style={{fontWeight: 'bold'}}>Moves:</Text> Tap any tile adjacent to the empty space to slide it into the empty slot.
            </Text>
            <Text style={{fontSize: 18, color: '#4A3018', marginBottom: 15, lineHeight: 28}}>
              <Text style={{fontWeight: 'bold'}}>Coins:</Text> Solve a puzzle manually in 50 moves or less to earn 1 Coin!
            </Text>
            <Text style={{fontSize: 18, color: '#4A3018', marginBottom: 15, lineHeight: 28}}>
              <Text style={{fontWeight: 'bold'}}>Min Steps:</Text> On 3x3 boards, this shows the mathematical minimum steps to win. On 4x4 boards, it shows a fast AI estimate ("Can be solved in"). Try to beat the estimate!
            </Text>
            <Text style={{fontSize: 18, color: '#4A3018', lineHeight: 28}}>
              <Text style={{fontWeight: 'bold'}}>Hints & AI:</Text> For 3x3 and 4x4, spend 1 Coin for a Hint before reaching 3x the minimum steps. After that, let the AI fully solve it! For larger boards (5x5+), only single best-move Hints are available (costs 1 Coin each).
            </Text>
          </View>

          <TouchableOpacity style={[styles.woodButton, {alignSelf: 'center'}]} onPress={() => setScreen('menu')}>
            <Text style={styles.woodButtonText}>Back to Menu</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'win') {
    const currentScoreKey = `size_${size}`;
    const best = bestScores[currentScoreKey] || { time: time, steps: steps };

    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center', padding: 20}]}>
        <Text style={{fontSize: 42, fontWeight: '900', color: '#553106', marginBottom: 20, textAlign: 'center'}}>Congratulations</Text>
        
        <Ionicons name="trophy" size={150} color="#FFD700" style={{marginBottom: 10}} />
        
        <Text style={{fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 30}}>{size}x{size} Classic</Text>

        <View style={{flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 50}}>
          <View style={{alignItems: 'center'}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10}}>Your</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Time</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{formatTime(time)}</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120, marginTop: 5}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Steps</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{steps}</Text>
            </View>
          </View>

          <View style={{alignItems: 'center'}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10}}>Best</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Time</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{formatTime(Math.min(best.time, time))}</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120, marginTop: 5}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Steps</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{Math.min(best.steps, steps)}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.woodButton, {marginBottom: 20}]} onPress={startGame}>
          <Text style={styles.woodButtonText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.woodButton} onPress={() => setScreen('menu')}>
          <Text style={styles.woodButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (screen === 'ai_win') {
    const currentScoreKey = `size_${size}`;
    const best = bestScores[currentScoreKey] || { time: time, steps: steps };

    return (
      <SafeAreaView style={[styles.container, {justifyContent: 'center', alignItems: 'center', padding: 20}]}>
        <Text style={{fontSize: 42, fontWeight: '900', color: '#553106', marginBottom: 20, textAlign: 'center'}}>Better luck next time</Text>
        
        <Text style={{fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 30}}>{size}x{size} Classic</Text>

        <View style={{flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 30}}>
          <View style={{alignItems: 'center'}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10}}>Your</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Time</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{formatTime(time)}</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120, marginTop: 5}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Steps</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{steps}</Text>
            </View>
          </View>

          <View style={{alignItems: 'center'}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 10}}>Best</Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Time</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{formatTime(Math.min(best.time, time))}</Text>
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', width: 120, marginTop: 5}}>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>Steps</Text>
              <Text style={{fontSize: 20, color: '#fff', fontWeight: 'bold'}}>{Math.min(best.steps, steps)}</Text>
            </View>
          </View>
        </View>

        <Text style={{fontSize: 20, fontWeight: 'bold', color: '#553106', marginBottom: 10}}>AI Solved Path:</Text>
        <View style={{maxHeight: 150, width: '100%', backgroundColor: 'rgba(51, 33, 21, 0.4)', borderRadius: 8, padding: 15, marginBottom: 30}}>
          <ScrollView nestedScrollEnabled>
            <Text style={{fontSize: 18, color: '#fff', textAlign: 'center', lineHeight: 28}}>
              {aiPath.join(' \u2192 ')}
            </Text>
          </ScrollView>
        </View>

        <TouchableOpacity style={[styles.woodButton, {marginBottom: 20}]} onPress={startGame}>
          <Text style={styles.woodButtonText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.woodButton} onPress={() => setScreen('menu')}>
          <Text style={styles.woodButtonText}>Main Menu</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- GAME UI ---
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  // Ensuring board scales down neatly on landscape or smaller height Android screens
  const boardDimension = Math.min(screenWidth * 0.9, screenHeight * 0.55, 450);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#CAC0B2' }}>
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        {/* Top action bar matching the empty cell color #332115 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconCircle} onPress={() => setScreen('menu')}>
          <Ionicons name="arrow-back" size={28} color="#A75A22" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.iconCircle} onPress={() => generatePuzzle(size)} disabled={solving}>
          <Ionicons name="shuffle" size={28} color="#A75A22" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <View style={{flexDirection: 'column', alignItems: 'flex-start'}}>
          <View style={styles.statPill}>
            <Text style={styles.statValue}>Steps: {steps}</Text>
          </View>
          {size <= 4 && minSteps > 0 && (
            <View style={[styles.statPill, {marginTop: 5, backgroundColor: 'rgba(51, 33, 21, 0.4)'}]}>
              <Text style={[styles.statValue, {fontSize: 14}]}>
                {size <= 3 ? `Min Steps: ${minSteps}` : `Can be solved in: ${minSteps}`}
              </Text>
            </View>
          )}
        </View>
        <View style={{flexDirection: 'column', alignItems: 'flex-end'}}>
          <View style={styles.statPill}>
            <Ionicons name="time-outline" size={16} color="#E8CFB1" style={{marginRight: 5}}/>
            <Text style={styles.statValue}>{formatTime(time)}</Text>
          </View>
          <View style={[styles.statPill, {marginTop: 5}]}>
            <Text style={styles.statValue}>Coins: {coins}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.gameTitle}>Classic</Text>

      {loading && <ActivityIndicator size="large" color="#332115" style={{marginVertical: 20}}/>}

      <View style={[styles.boardWrapper, { width: boardDimension, height: boardDimension }]}>
        <View style={styles.gridContainer}>
          {!loading && board.map((val, idx) => {
            const isEmpty = val === 0;
            // Create a transparent pressable overlay above the animated tile so clicks are captured accurately on the grid matrix.
            const tileWidth = `${100 / size}%` as any;
            return (
              <TouchableOpacity
                key={`touch-${idx}`} 
                style={{ width: tileWidth, height: tileWidth, zIndex: 10 }}
                activeOpacity={1}
                onPress={() => moveTile(idx)}
                disabled={isEmpty || solving}
              />
            );
          })}
          
          {/* Absolute rendered animated blocks underneath */}
          {!loading && board.map((val, idx) => {
            return (
              <AnimatedTile 
                key={`anim-${val}`} 
                value={val} 
                index={idx} 
                size={size} 
                boardDimension={boardDimension} 
                isEmpty={val === 0} 
              />
            );
          })}
        </View>
      </View>

      {(() => {
        if (size <= 4) {
          const targetSolveMoves = minSteps ? minSteps * 3 : 100;
          return (
            <View style={{alignItems: 'center'}}>
              <TouchableOpacity 
                style={[styles.woodButton, {marginTop: 40}, solving && {opacity: 0.7}]} 
                onPress={solvePuzzle}
                disabled={solving || board.length === 0}
              >
                <Text style={styles.woodButtonText}>
                  {solving ? "Calculating..." : (steps < targetSolveMoves ? "Hint (1 Coin)" : "Solve with AI")}
                </Text>
              </TouchableOpacity>
              <Text style={{color: '#553106', marginTop: 10, fontWeight: 'bold'}}>
                {steps < targetSolveMoves ? `Reach ${targetSolveMoves} moves for AI solve` : `AI Solve Available!`}
              </Text>
            </View>
          );
        } else {
          return (
            <View style={{alignItems: 'center'}}>
              <TouchableOpacity 
                style={[styles.woodButton, {marginTop: 40}, solving && {opacity: 0.7}]} 
                onPress={solvePuzzle}
                disabled={solving || board.length === 0}
              >
                <Text style={styles.woodButtonText}>
                  {solving ? "Calculating..." : "Hint (1 Coin)"}
                </Text>
              </TouchableOpacity>
              <Text style={{color: '#553106', marginTop: 10, fontWeight: 'bold'}}>
                Only Hint allowed for larger boards
              </Text>
            </View>
          );
        }
      })()}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#CAC0B2', // Wood table background color
  },
  menuBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuSectionTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#F4F4F4',
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 3,
    marginBottom: 15,
    marginTop: 20,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 300,
  },
  sizeRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
    width: 70,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4A3018',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#E8DCCB'
  },
  radioActive: {
    borderColor: '#4A3018',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A3018',
  },
  radioText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FCFDFE',
    textShadowColor: '#4A3018',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  previewBox: {
    marginVertical: 30,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FCFDFE',
    textShadowColor: '#4A3018',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },
  previewSubtitle: {
    fontSize: 16,
    color: '#4A3018',
    fontWeight: '600',
    marginTop: 5,
  },
  woodButton: {
    backgroundColor: '#B57849',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#593213',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  woodButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
  },

  // GAME STYLES 
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#332115', // Matches empty tile
    paddingTop: Platform.OS === 'web' ? 10 : 40,
    paddingBottom: 10,
    paddingHorizontal: 15,
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#A88052', // light wood circle
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#734620'
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  statPill: {
    backgroundColor: '#401503',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  statValue: {
    color: '#E8CFB1',
    fontWeight: 'bold',
    fontSize: 16,
  },
  gameTitle: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FCFDFE',
    textShadowColor: '#4A3018',
    textShadowOffset: {width: 1, height: 1},
    textShadowRadius: 2,
    marginVertical: 15,
  },
  boardWrapper: {
    alignSelf: 'center',
    backgroundColor: '#D19642', // border of board
    padding: 5,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#8A5623',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    position: 'relative'
  },
  tileWrapper: {
    padding: 1,
  },
  tileInner: {
    backgroundColor: '#E4B889', // Normal tile
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#AE8053',
    borderRadius: 6,
  },
  emptyTile: {
    backgroundColor: '#332115', // Empty slot colour (dark brown)
    borderColor: '#332115',
  },
  tileText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#553616',
  }
});