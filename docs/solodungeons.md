# Solo Dungeons & Rune Drops Module

Solo Dungeons and Rune Drops feature for Stellar Odyssey game.

## Overview

This module provides:
- Fetch and display Solo Dungeons and Rune Drops lists
- Multi-dimensional scoring based on distance, rewards, difficulty, and time
- Route planning with step-limited pathfinding
- Save/load selected routes to localStorage

## Data Sources

| Endpoint | Data |
|----------|------|
| `/api/public/solodungeons` | Solo dungeons list with coordinates, rewards, difficulty |
| `/api/public/activerunes` | Active rune drops with similar structure |
| `/api/public/user` | Player location, stats, equipment |
| `/api/public/journal` | Player's current position |

## Scoring System

Each item is scored based on multiple factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Distance** | 30% | Normalized to current list range (nearest=100, farthest=0) |
| **Time** | 25% | Hours until expiry (19h=100, 0h=0) |
| **Reward** | 25% | Reward modifier (-28%~+50%) |
| **Difficulty** | 10% | Difficulty modifier (-20%~+20%) |
| **Attempts** | 10% | Available attempts (12=100) |

**Score Formula:**
```
score = distance*0.30 + time*0.25 + reward*0.25 + difficulty*0.10 + attempts*0.10
```

## Distance Calculation

Distance is calculated using `PathfinderService` with step-limited pathfinding:

1. **With step limit**: Uses `findStepLimitedPath()` to calculate exact path with hops ≤ 100/120 LY
2. **Without step limit**: Uses `findShortestPath()` for direct distance

The distance bounds (min/max) are recalculated each time based on currently available items, ensuring proper normalization.

## Key Features

### Route Selection

- **Add to Route**: Adds item to selected route, removes from available list
- **Remove from Route**: Removes item from route, returns to available list
- **Clear Route**: Returns all items to available list
- **Save/Load Route**: Persist routes to localStorage

### Dynamic Recalculation

When an item is added/removed from route:
1. Recalculate distance bounds from new starting position
2. Re-score all remaining items
3. Re-render the list

### Step Limit Mode

Toggle between:
- **Unlimited**: Direct shortest path
- **100 LY**: Maximum 100 LY per hop
- **120 LY**: Maximum 120 LY per hop

## Data Structure

### Dungeon/Rune Item
```javascript
{
  id: string,              // Unique key (coordinate + timestamp)
  type: 'dungeon' | 'rune',
  system: { coordinate_x, coordinate_y },
  closesAt: number,        // Unix timestamp (seconds)
  attempts: number,        // Available attempts
  reward_modifier: number,
  difficulty_modifier: number,
  // ... other fields
}
```

### Selected Route
```javascript
{
  startPos: { x, y },      // Starting position for this leg
  items: [
    { ...item, score, details }
  ]
}
```

## Path Detail Panel

Shows detailed path for selected item:

- Total distance
- Number of hops
- Each segment:
  - From/To coordinates
  - Distance (LY)
  - Hop type (flight/station-jump/starter-jump)
  - Flag if space station

## API Integration

The module reuses data from Battle Tab:
- User API data is shared via `window.stellarOdysseyUserData`
- Pathfinder grid is shared via `PathfinderService`

**Data Loading Flow:**
1. Check if User API data exists
2. If not, fetch and populate Battle Tab
3. Load Solo Dungeons / Rune Drops
4. Validate player position matches
5. Calculate scores with pathfinding

## LocalStorage Keys

| Key | Data |
|-----|------|
| `systems_api_key` / `api_key` | API authentication key |
| `player_position` | Cached player position `{x, y}` |
| `solo_dungeons_routes` | Saved routes JSON |

## Events

The module fires no external events; UI updates are handled internally via recalculation and re-rendering.
