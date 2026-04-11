# Pathfinder Module

Star map pathfinding algorithm for Stellar Odyssey game.

## Overview

The pathfinder module calculates the shortest path between two coordinates in a 2000x2000 star map, taking advantage of special zero-distance networks.

## Two Zero-Distance Networks

The game has two isolated zero-distance networks that **cannot communicate with each other**:

| Network | Nodes | Connection Rules |
|---------|-------|------------------|
| **Starter Network** | 9 points: `(250,250)` to `(1750,1750)` step 750 | All pairs jump at 0 distance |
| **Station Network** | All space stations with `space_portal: true` | All pairs jump at 0 distance |

## Core Algorithms

### findShortestPath(start, end)

Finds the optimal path without step limits.

**Three Plans (pick the shortest):**

```
S-Plan: start → nearest Starter → [Starter jumps, 0 distance] → nearest Starter → end
P-Plan: start → nearest Portal Station → [Station jumps, 0 distance] → nearest Portal Station → end
D-Plan: start → end (direct flight)
```

**Return Value:**
```javascript
{
  starterSystemOnly: { distance, path, trajectories },
  withSpaceStation: { distance, path, trajectories }
}
```

### findStepLimitedPath(start, end, stepLimit)

Finds optimal path with step limit (100, 120, or unlimited).

**Process:**
1. Use `findShortestPath` to determine optimal plan (S/P/D)
2. Split only the "flight segments" into chunks of ≤ stepLimit
3. Zero-distance segments remain unchanged

**Constraints:**
- All coordinates are integers
- All hops ≤ stepLimit
- Each hop moves closer to the destination (greedy search)

## Coordinate Parser

`CoordinateParser.parse(input)` accepts multiple formats:
- `{x, y}` object
- `[x, y]` array
- `{coordinate_x, coordinate_y}` API format
- `"x, y"` string
- `"[x, y]"` string
- `"x=100,y=200"` string

## Usage Example

```javascript
// Create grid
const grid = new PathfinderGrid();

// Add portal space stations
grid.addPortedSpaceStations([
    { space_portal: true, system: { coordinate_x: 500, coordinate_y: 500 } },
    { space_portal: true, system: { coordinate_x: 1500, coordinate_y: 1500 } },
]);

// Find shortest path (no limit)
const result = grid.findShortestPath({ x: 100, y: 100 }, { x: 1800, y: 1800 });
console.log(result.withSpaceStation.distance); // e.g., 2828.43 LY

// Find path with 100 LY step limit
const limited = grid.findStepLimitedPath({ x: 100, y: 100 }, { x: 1800, y: 1800 }, 100);
console.log(limited.trajectories.length); // e.g., 31 hops
```

## Path Trajectory Format

Each trajectory segment:
```javascript
{
  from: { x, y },
  to: { x, y },
  distance: number,  // LY, 0 for network jumps
  hopType: 'starter-entry' | 'starter-jump' | 'starter-exit' |
            'station-entry' | 'station-jump' | 'station-exit' |
            'direct-flight'
}
```

## PathfinderService (Singleton)

Use the singleton for shared grid instance:

```javascript
// Initialize with space stations
PathfinderService.initFromUserData(squadronSpaceStations, force);

// Or auto-initialize
const grid = await PathfinderService.ensureInitialized(apiKey);

// Get grid anytime
const grid = PathfinderService.getGrid();
```

## Mathematical Proof

**Why not switch between networks at exit?**

For any three points A (exit), B (any network node), C (destination):
```
d(A, C) ≤ d(A, B) + d(B, C)
```

Since `d(A, B) > 0` when A ≠ B, direct flight from exit is always optimal.
