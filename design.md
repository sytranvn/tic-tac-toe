# Tic Tac Toe Online - Design Documentation

## 1. Architecture Overview
The application is built as a real-time, full-stack web application using **Next.js** for the frontend and a custom **Express** server for the backend, sharing the same port (3000).

### Key Technologies:
- **Frontend**: React, Next.js (App Router), Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, Socket.io.
- **Database**: SQLite (via `better-sqlite3`) with **Drizzle ORM**.
- **Icons**: Lucide React.

---

## 2. Real-time Communication
We use **Socket.io** to handle persistent, low-latency connections between players.

### Design Decisions:
- **Room-Based Isolation**: Every game session is assigned a unique `gameId`. Players join a Socket.io "room" for that ID. This ensures that move events are only broadcast to the two participants of that specific game, reducing network overhead.
- **Event-Driven Flow**:
    - `find_match`: Clients request to join a queue.
    - `match_found`: Server notifies two players and provides the initial state.
    - `make_move`: Clients send move intents; server validates and broadcasts `game_update`.
    - `request_rematch`: Handles the logic for two players wanting to play again without re-entering the global queue.

---

## 3. Database Design
We chose a **Relational Database (SQLite)** to ensure data integrity and support structured queries for game history.

### Schema:
- **Games Table**: Stores metadata for every match (size, win length, players, status, winner, timestamps).
- **Moves Table**: Stores a chronological log of every move made in every game. This allows for future features like "Game Replays."

### Drizzle ORM:
Used for type-safe interactions and simplified schema management. It provides a clean abstraction over raw SQL while maintaining performance.

---

## 4. Game Logic
The server acts as the **Source of Truth** (Server-Authoritative).

### Decisions:
- **Validation**: The server checks if it's the player's turn, if the cell is empty, and if the game is active before accepting a move.
- **Win Detection**: A generic algorithm scans rows, columns, and diagonals based on the `winLength` (3 for 3x3, 4 for 5x5). This allows for easy expansion to larger boards (e.g., 10x10).
- **State Management**: Active game states are kept in a server-side `Map` for $O(1)$ access speed, while being persisted to the DB asynchronously.

---

## 5. Scaling Strategy

### Vertical Scaling
- **Node.js Cluster**: Utilize the `cluster` module to spawn one worker process per CPU core. This allows a single machine to handle significantly more concurrent connections by distributing the load across all available cores.

### Horizontal Scaling with Redis
When the application grows beyond a single server, horizontal scaling becomes necessary. This involves running multiple instances of the server behind a Load Balancer.

#### 1. Socket.io Redis Adapter
- **Pub/Sub Mechanism**: We implement the `@socket.io/redis-adapter`. When a server node emits an event to a room (e.g., `io.to(gameId).emit(...)`), the adapter publishes this message to a Redis channel. All other server nodes subscribed to that channel receive the message and broadcast it to their locally connected clients in that room.
- **Cross-Server Communication**: This allows Player A on Server 1 to communicate seamlessly with Player B on Server 2.

#### 2. Distributed State Management
- **From Memory to Redis**: The current in-memory `games` Map must be replaced with a **Redis Store**. Active game states should be stored as Redis Hashes or JSON strings.
- **Stateless Servers**: By moving the game state to Redis, any server node can retrieve the current board, validate a move, and update the state. This makes the individual server nodes "stateless" regarding the active games.

#### 3. Distributed Matchmaking
- **Shared Queues**: The `waitingPlayers` queues must be moved to **Redis Lists**.
- **Atomic Operations**: When a player looks for a match, the server uses atomic Redis commands (like `LPOP` or `RPOPLPUSH`) to ensure that a player is matched exactly once, even if multiple servers are processing matchmaking requests simultaneously.

#### 4. Load Balancing & Sticky Sessions
- **Handshake Consistency**: WebSockets start with an HTTP handshake that may involve multiple requests. A Load Balancer (like Nginx or AWS ALB) must be configured with **Sticky Sessions** (Session Affinity) to ensure that all packets for a specific connection are routed to the same server node during the handshake phase.

#### 5. Distributed Locking
- **Redlock**: To prevent race conditions (e.g., two moves being processed for the same game at the exact same microsecond on different servers), we can implement a distributed locking mechanism like **Redlock** using Redis. This ensures that only one server node can modify a specific game's state at a time.

---

## 6. UI/UX Design
The interface is designed to feel "premium" and "technical" rather than a generic toy.

### Recipes Used:
- **Dark Luxury / Technical**: Using `zinc-950` backgrounds with `emerald` and `blue` accents.
- **Atmospheric**: Subtle radial gradients and backdrop blurs create depth.
- **Motion**: `framer-motion` (via `motion/react`) is used for:
    - Smooth transitions between Landing, Searching, and Playing states.
    - Animated X and O placements.
    - Trophy and result card entrance animations.

---

## 7. Matchmaking
- **Queue System**: Separate queues are maintained for different board sizes (3x3 vs 5x5).
- **First-In-First-Out (FIFO)**: The first player to join a queue waits for the next available player of the same type.
- **Cleanup**: Disconnects are handled gracefully, removing players from queues and awarding wins to opponents in active games.
