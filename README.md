# 8-Puzzle & 15-Puzzle Game

A fully responsive, interactive sliding tile puzzle game built with React Native and Expo. Challenge yourself to solve the classic 3x3 (8-puzzle) or the more complex 4x4 (15-puzzle) board!

## Features
* **Dual Game Modes:** Play either the 3x3 board or the 4x4 board.
* **Smart AI Solver:** 
  * Uses the **A* Search Algorithm** to find the absolute minimum steps for 3x3 boards.
  * Uses a highly optimized **Greedy Best-First Search** for 4x4 boards for fast and intelligent approximations without crashing your device.
* **Persistent Storage:** Your coin balance and "Personal Best" score are saved locally on your device using `@react-native-async-storage/async-storage`.
* **Mobile Optimized UI:** Fully responsive design that respects Android/iOS safe areas, notches, and system bars (using `SafeAreaView`).

## Tech Stack
* **Frontend:** React Native, Expo, TypeScript
* **Algorithms:** A* Pathfinding (Manhattan Distance Heuristic), Greedy Best-First Search
* **Local Storage:** React Native Async Storage

## How to Run Locally

### Prerequisites
* Node.js installed
* Expo CLI installed

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   ```
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Expo development server:
   ```bash
   npx expo start
   ```

## Build for Android (APK)
To create a standalone Android APK, you can run the following commands inside the `frontend` folder:
```bash
npx expo prebuild --clean
cd android
./gradlew assembleRelease
```
The generated APK will be located in `android/app/build/outputs/apk/release/app-release.apk`.

## How to Play
1. The goal is to arrange the tiles in ascending order (1 to 8 or 1 to 15), with the empty space at the very end.
2. Tap adjacent tiles to slide them into the empty space.
3. Keep track of your moves and time—try to beat your **Personal Best**!
4. Earn coins every time you solve the puzzle manually. 
5. Stuck? Use the **Hint / Solve AI** to watch the computer solve it for you.


