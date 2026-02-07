# Tartanverse - Location-Based Community Social Network

"Mosaic" is a browser-based, location-aware multiplayer game where players can explore a 3D map of their campus, interactions with other players in real-time, link "bank accounts" to upgrade their status, and complete physical side quests for rewards.

## Prerequisites

- **Node.js** (LTS version recommended)
- **Mapbox Access Token** (Sign up at [Mapbox](https://www.mapbox.com/))

## Installation & Setup

### 1. Project Setup

Open your terminal and navigate to the project root.

### 2. Client Setup (Frontend)

Navigate to the client directory and install dependencies:

```bash
cd client
npm install
```

**Configuration:**
Create a `.env` file in the `client` directory to store your Mapbox token:

```bash
# mosaic-game/client/.env
REACT_APP_MAPBOX_TOKEN=pk.eyJ... # Your actual Mapbox Token here
```

### 3. Server Setup (Backend)

Navigate to the server directory and install dependencies:

```bash
cd ../server
npm install
```

## Running the Application

You need to run both the backend server and the frontend client simultaneously.

### Start the Server

In a terminal window:

```bash
cd server
npm start
```

The server will start on `http://localhost:3001`.

### Start the Client

In a separate terminal window:

```bash
cd client
npm start
```

The application will open in your browser at `http://localhost:3000`.

## Features & Usage

1.  **Map & Geolocation**: Click the GPS icon in the top-left to center the map on your location.
2.  **Multiplayer**: Open the app in multiple tabs or browsers to see other players (red markers) move in real-time.
3.  **Economy**:
    - Click the Wallet icon/card in the top-right.
    - Click "Link Bank Account" to simulate linking a bank.
    - If your random balance is > $500, you gain "Premium Tile Status".
4.  **Side Quests**:
    - Walk to "The Fence" (Coordinates: 40.4432, -79.9428).
    - Upon entering the zone (30m radius), you will receive a generic "Quest Complete" alert and 50 coins.
    - _Tip: You can simulate this using Chrome DevTools -> More tools -> Sensors._

## Tech Stack

- **Frontend**: React, Mapbox GL JS, Socket.io-client
- **Backend**: Node.js, Express, Socket.io
- **Data**: In-memory storage (for MVP)

## Troubleshooting

- **Map not loading?** Ensure your `REACT_APP_MAPBOX_TOKEN` in `client/.env` is valid.
- **GPS not working?** Ensure you have allowed location permissions in your browser.
- **Multiplayer not working?** Ensure the server is running on port 3001 and the client is trying to connect to `localhost:3001`.
>>>>>>> 84bb48b (final push)
