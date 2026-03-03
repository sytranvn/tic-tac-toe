# Design Decisions - Tic Tac Toe Online

This document outlines the architectural and design decisions made for the Tic Tac Toe Online application.

## 1. Architecture Overview

The application is built as a full-stack Next.js application with a custom Express server to support real-time, multi-user interactions via WebSockets.

### Core Stack
- **Framework**: Next.js 15+ (App Router)
- **Server**: Express.js (Custom server for WebSocket support)
- **Real-time Engine**: Socket.io
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion (`motion/react`)
- **Icons**: Lucide React

## 2. Real-Time Communication

### WebSocket Integration
Since the application requires low-latency, bi-directional communication for multiplayer gameplay, **Socket.io** was chosen over standard HTTP polling.
- The server runs on the same port (3000) as the Next.js application.
- `socket.io` handles the WebSocket handshake and provides an event-based API for game logic.

### Matchmaking System
- **Queue-based**: Players are placed in a waiting queue based on their selected board size (3x3 or 5x5).
- **Random Pairing**: The first available player in the queue is matched with the next connecting player.
- **Room Isolation**: Once matched, both players join a unique Socket.io room (`game_ID`) to isolate their game events from other active sessions.

### Game State Management
- **Server-Authoritative**: The server maintains the "Source of Truth" for the game board, current turn, and win conditions.
- **Validation**: Every move is validated on the server (e.g., checking if it's the player's turn, if the cell is empty, and if the game is still active).
- **Synchronization**: After every valid move, the updated game state is broadcasted to both players in the room.

## 3. UI/UX Design

### Visual Identity
- **Dark Theme**: A modern, high-contrast dark theme using `zinc` and `emerald` color palettes.
- **Typography**: Bold, tracking-tight headings for a "Tech/Gaming" feel.
- **Atmospheric Background**: Subtle radial gradients and blurs to create depth without distracting from the gameplay.

### Interaction Design
- **Framer Motion**: Used for smooth transitions between game states (Idle -> Searching -> Playing -> Finished).
- **Responsive Layout**: The game board scales dynamically based on the selected size (3x3 or 5x5) and screen width.
- **Feedback Loops**:
  - Pulse animations for "Live" status.
  - Loading spinners during matchmaking.
  - Trophy icons and scale animations for game results.

## 4. Game Mechanics

### Board Sizes
- **3x3**: Standard Tic Tac Toe rules (3 in a row to win).
- **5x5**: Extended board for longer play sessions (4 in a row to win).

### Rematch System
- Players can request a rematch after a game ends.
- The game resets only when **both** players agree to a rematch.
- Starting players are randomized for rematches to ensure fairness.

### Disconnection Handling
- If a player disconnects during an active game, the opponent is automatically declared the winner.
- Players are removed from matchmaking queues upon disconnection to prevent "ghost" matches.

## 5. Deployment & Infrastructure
- **Port 3000**: The application is configured to run exclusively on port 3000, as required by the environment.
- **ES Modules**: The project uses modern ES Module syntax for both client and server code.
