import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming, Easing, useSharedValue, withSequence, runOnJS } from 'react-native-reanimated';

const API_URL = Platform.OS === 'web' ? 'http://localhost:8080/puzzle' : 'http://10.0.2.2:8080/puzzle';

// Expose duration variable to control the sliding transition speed (in milliseconds)
const SLIDE_DURATION_MS = 75; 

// A distinct component for each animated tile so we can manage absolute positioning internally.
const AnimatedTile = ({ value, index, size, boardDimension, isEmpty }) => {
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
  const [screen, setScreen] = useState('menu');
  const [size, setSize] = useState(3);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [solving, setSolving] = useState(false);
  
  const [steps, setSteps] = useState(0);
  const [time, setTime] = useState(0);
  const [bestScores, setBestScores] = useState({});

  const sizes = [3, 4, 5, 6, 7, 8];

  // Timer loop
  useEffect(() => {
    let interval;
    if (screen === 'game' && !solving && !loading && board.length > 0) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [screen, solving, loading, board]);

  const generatePuzzle = async (selectedSize) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: selectedSize })
      });
      const data = await response.json();
      setBoard(data.board);
      setSteps(0);
      setTime(0);
    } catch (error) {
      console.warn(error);
      Alert.alert('Error', 'Failed to connect to backend. Is Spring Boot running?');
    } finally {
      setLoading(false);
    }
  };

  const startGame = () => {
    setScreen('game');
    generatePuzzle(size);
  };

  const solvePuzzle = async () => {
    if (board.length === 0 || solving) return;
    setSolving(true);
    
    try {
      const response = await fetch(`${API_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: size, board: board })
      });
      const data = await response.json();
      
      if (!data.solvable || data.solution.length === 0) {
        Alert.alert('Info', 'Puzzle is unsolvable from this state or timed out.');
        setSolving(false);
        return;
      }

      // Record best AI score for this size
      const currentScoreKey = `size_${size}`;
      const previousBest = bestScores[currentScoreKey] || { time: Infinity, steps: Infinity };
      const newScore = {
        time: Math.min(previousBest.time, time),
        steps: Math.min(previousBest.steps, data.steps)
      };
      setBestScores({ ...bestScores, [currentScoreKey]: newScore });

      // Animate solution
      for (let i = 0; i < data.solution.length; i++) {
        setBoard([...data.solution[i]]);
        setSteps(prev => prev + 1);
        // We pause execution explicitly allowing Reanimated to interpolate the translation.
        await new Promise(resolve => setTimeout(resolve, SLIDE_DURATION_MS + 20));
      }
      
    } catch (error) {
      Alert.alert('Error', 'Failed to solve.');
      console.warn(error);
    } finally {
      setSolving(false);
    }
  };

  const moveTile = (index) => {
    if (solving || board[index] === 0) return;

    const blankIndex = board.indexOf(0);
    const row = Math.floor(index / size);
    const col = index % size;
    const blankRow = Math.floor(blankIndex / size);
    const blankCol = blankIndex % size;

    if (row === blankRow) {
      const newBoard = [...board];
      if (col < blankCol) {
        for (let i = blankCol; i > col; i--) newBoard[row * size + i] = newBoard[row * size + i - 1];
      } else {
        for (let i = blankCol; i < col; i++) newBoard[row * size + i] = newBoard[row * size + i + 1];
      }
      newBoard[index] = 0;
      setBoard(newBoard);
      setSteps(prev => prev + 1);
      
    } else if (col === blankCol) {
      const newBoard = [...board];
      if (row < blankRow) {
        for (let i = blankRow; i > row; i--) newBoard[i * size + col] = newBoard[(i - 1) * size + col];
      } else {
        for (let i = blankRow; i < row; i++) newBoard[i * size + col] = newBoard[(i + 1) * size + col];
      }
      newBoard[index] = 0;
      
      setBoard(newBoard);
      setSteps(prev => prev + 1);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (screen === 'menu') {
    return (
      <View style={styles.container}>
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
            <Text style={styles.previewSubtitle}>Best AI Run: {bestScores[`size_${size}`] ? `${bestScores[`size_${size}`].steps} steps | ${formatTime(bestScores[`size_${size}`].time)}` : 'N/A'}</Text>
          </View>

          <TouchableOpacity style={styles.woodButton} onPress={startGame}>
            <Text style={styles.woodButtonText}>New Game</Text>
          </TouchableOpacity>

        </View>
      </View>
    );
  }

  // --- GAME UI ---
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  // Ensuring board scales down neatly on landscape or smaller height Android screens
  const boardDimension = Math.min(screenWidth * 0.9, screenHeight * 0.55, 450);

  return (
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
        <View style={styles.statPill}>
          <Text style={styles.statValue}>Steps: {steps}</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="time-outline" size={16} color="#E8CFB1" style={{marginRight: 5}}/>
          <Text style={styles.statValue}>{formatTime(time)}</Text>
        </View>
      </View>

      <Text style={styles.gameTitle}>Classic</Text>

      {loading && <ActivityIndicator size="large" color="#332115" style={{marginVertical: 20}}/>}

      <View style={[styles.boardWrapper, { width: boardDimension, height: boardDimension }]}>
        <View style={styles.gridContainer}>
          {!loading && board.map((val, idx) => {
            const isEmpty = val === 0;
            // Create a transparent pressable overlay above the animated tile so clicks are captured accurately on the grid matrix.
            const tileWidth = `${100 / size}%`;
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

      {size <= 4 && (
        <TouchableOpacity 
          style={[styles.woodButton, {marginTop: 40, alignSelf: 'center'}, solving && {opacity: 0.7}]} 
          onPress={solvePuzzle}
          disabled={solving || board.length === 0}
        >
          <Text style={styles.woodButtonText}>{solving ? "Calculating..." : "Solve with AI"}</Text>
        </TouchableOpacity>
      )}
      
    </ScrollView>
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