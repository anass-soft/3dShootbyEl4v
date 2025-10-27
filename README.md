# Made By El4v.Dev - Multiplayer FPS

A browser-based real-time multiplayer first-person shooter built with Three.js, Node.js, and Socket.IO.

## Features
- Real-time multiplayer (up to 10 players per room)
- Room-based matchmaking with 6-character room codes
- Two weapons: AK-47 (automatic) and Sniper Rifle (one-shot kill)
- Procedurally generated 3D map (no external assets)
- Desktop and mobile support
- Server-authoritative gameplay (anti-cheat)

## Tech Stack
- **Frontend:** Three.js, HTML5, CSS3, JavaScript (ES Modules)
- **Backend:** Node.js, Express.js, Socket.IO
- **No database** (in-memory game state)

## Setup Instructions

### Prerequisites
- Node.js v16 or higher
- npm (comes with Node.js)

### Installation
1. Clone or download this repository
2. Navigate to project directory:
   ```bash
   cd 3dShootbyEl4v
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game
1. Start the server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
3. To test multiplayer, open multiple browser tabs or invite friends to your network

### Controls

**Desktop:**
- **WASD:** Move
- **Mouse:** Look around
- **Left Click / Space:** Shoot
- **C:** Toggle crouch
- **1:** Switch to AK-47
- **2:** Switch to Sniper Rifle

**Mobile:**
- **Left Joystick:** Move
- **Touch and Drag:** Look around
- **Red Button:** Shoot
- **Jump Button:** Jump
- **Crouch Button:** Toggle crouch
- **Weapon Buttons (top right):** Switch weapons

### How to Play
1. Enter your username (3-15 characters)
2. Create a new room or join existing room via room code
3. Click "READY UP" when ready to start
4. Game starts automatically when 2+ players are ready after 10-second countdown
5. First-person shooter gameplay - eliminate other players to increase your score
6. Respawn after 3 seconds when eliminated

### File Structure
```
3dShootbyEl4v/
├── package.json
├── README.md
├── server/
│   ├── server.js          # Main server entry
│   ├── roomManager.js     # Room logic
│   ├── playerManager.js   # Player state
│   └── gameLogic.js       # Game loop & physics
└── client/
    ├── index.html         # Main HTML
    ├── style.css          # Styling
    ├── main.js            # Game initialization
    ├── game/
    │   ├── player.js      # Player logic
    │   ├── weapon.js      # Weapon logic
    │   ├── map.js         # Map generation
    │   └── ui.js          # HUD rendering
    └── network/
        └── socketHandler.js  # Socket.IO client
```

### Troubleshooting

**"Cannot find module 'express'"**
- Run `npm install` to install dependencies

**"Port 3000 already in use"**
- Close other applications using port 3000 or change port in `server/server.js`

**Game doesn't load/black screen**
- Check browser console for errors
- Ensure WebGL is supported (use modern browser)
- Try refreshing the page

**High latency/lag**
- Check your network connection
- Game uses server-authoritative model, so some latency is normal
- Host server closer to players for better performance

### Development Notes
- Server runs at 20Hz (50ms tick rate)
- Client runs at 60 FPS
- All game logic is server-authoritative to prevent cheating
- No persistent data storage (all state in-memory)

### Credits
Made By El4v.Dev

### License
Open source - feel free to use and modify