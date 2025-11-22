# Selection Resize and Move Feature

## Overview
Added ability to resize selections by dragging borders/corners and move selections by dragging the selection area.

## New Features

### 1. Resize Selection
- **8 resize handles** appear on the selection box:
  - 4 corners: NW, NE, SE, SW
  - 4 edges: N, E, S, W
- Drag any handle to resize the selection
- Cursor changes to show resize direction
- Selection normalizes after resizing (start is always top-left)

### 2. Move Selection
- Click and drag inside the selection to move it
- Cursor shows "move" when hovering inside selection
- Preserves selection size while moving
- Works at any zoom level

### 3. Smart Click Detection
- Clicking **inside** selection → starts move operation
- Clicking **on handle** → starts resize operation  
- Clicking **outside** selection → clears old selection and creates new one
- Clicking on handle prevents creating new selection

## Implementation Details

### New State Variables
```javascript
this.resizing = false
this.resizeHandle = null  // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
this.moving = false
this.moveStartMouse = { x: 0, y: 0 }
this.moveStartSelection = { x1: 0, y1: 0, x2: 0, y2: 0 }
```

### Visual Elements
Added 8 resize handle divs in the selection box:
```html
<div class="selection-box">
  <div class="selection-handle nw"></div>
  <div class="selection-handle n"></div>
  <!-- ... 6 more handles ... -->
</div>
```

### CSS Styling
- Handles: 8x8px squares with accent color background
- Border: White border for contrast
- Cursors: Directional resize cursors (nw-resize, n-resize, etc.)
- Selection box: Subtle background tint with move cursor

### Mouse Event Flow

**Resize:**
1. User clicks on handle → `handleMouseDown` sets `resizing = true` and `resizeHandle`
2. User moves mouse → Updates selection coordinates based on handle direction
3. User releases → Normalizes selection coordinates

**Move:**
1. User clicks inside selection → Sets `moving = true`, stores start positions
2. User moves mouse → Calculates delta and updates both corners
3. User releases → Normalizes selection coordinates

**Create New:**
1. User clicks outside selection → Clears old selection, starts new one
2. Same behavior as before

## Coordinate System Integration
All resize and move operations work in **image space**, so they:
- Work correctly at any zoom level
- Transform properly when panning
- Maintain precision regardless of viewport size

## Edge Cases Handled

1. **Inverted selections**: After resize, coordinates are normalized (min/max)
2. **Handle click prevention**: Clicking handle doesn't trigger new selection
3. **Inside selection detection**: Properly detects if click is inside bounds
4. **Small selections**: Minimum size check still applies
5. **Pan during operation**: Selection updates position during pan

## User Experience

### Resize
- Grab any handle to resize from that edge/corner
- Opposite corner stays fixed during resize
- Visual feedback with directional cursors
- Smooth resizing at any zoom level

### Move
- Click and drag anywhere inside selection
- Entire selection moves together
- Visual feedback with move cursor
- Can move to any position on image

### Create New
- Click outside existing selection to start fresh
- Old selection automatically cleared
- No need to manually clear selection first

## CSS Classes

### Resize Handles
```css
.selection-handle {
  width: 8px;
  height: 8px;
  background: accent-color;
  border: 1px solid white;
  pointer-events: auto;
}

.selection-handle.nw { cursor: nw-resize; }
/* ... etc for all 8 directions ... */
```

### Selection Box
```css
.selection-box {
  border: 2px solid accent-color;
  pointer-events: none;
  cursor: move;
  background: rgba(255, 255, 255, 0.02);
}
```

## Testing Scenarios

### Test Resize
1. Create selection
2. Hover over corner handle (cursor changes to diagonal)
3. Drag to resize
4. Release - selection stays at new size
5. Verify at different zoom levels

### Test Move
1. Create selection
2. Click inside selection area (not on handle)
3. Drag to new position
4. Release - selection moves to new location
5. Verify works when zoomed/panned

### Test Edge Cases
1. Resize to very small size (should work)
2. Resize by dragging corner past opposite corner (normalizes correctly)
3. Move selection partially off image (allowed)
4. Try to resize while zoomed at 400% (smooth operation)
5. Pan while selection is visible (selection follows image)

## Future Enhancements
- Constrain selection to image bounds during move
- Snap to edges/grid
- Keyboard nudging (arrow keys)
- Aspect ratio lock during resize (Shift key)
- Display selection dimensions while resizing
