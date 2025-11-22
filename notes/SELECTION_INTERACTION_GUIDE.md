# Selection Interaction Quick Reference

## Visual Layout

```
┌─────────────────────────────────┐
│   Image Container               │
│                                 │
│       ┌─■─────────■─────────■─┐ │
│       │ NW      N         NE │ │
│       ■                      ■ │
│       │ W    SELECTION     E │ │  ← Selection Box with Handles
│       ■                      ■ │
│       │ SW      S         SE │ │
│       └─■─────────■─────────■─┘ │
│                                 │
└─────────────────────────────────┘

■ = Resize Handle (8x8px, clickable)
Selection Area = Move zone (click & drag inside)
```

## Mouse Interactions

### Creating Selection
```
Click outside existing selection
  ↓
Drag to define area
  ↓
Release to finish
```

### Resizing Selection
```
Hover over handle (cursor changes)
  ↓
Click and drag handle
  ↓
Release to finish resize
```

### Moving Selection
```
Click inside selection area (not on handle)
  ↓
Drag to new position
  ↓
Release to finish move
```

### Clearing Selection
```
Click outside existing selection
  (without dragging)
  ↓
Old selection clears
New selection starts
```

## Cursor Visual Guide

| Location | Cursor | Action |
|----------|--------|--------|
| NW handle | ↖ (nw-resize) | Resize from top-left corner |
| N handle | ↑ (n-resize) | Resize from top edge |
| NE handle | ↗ (ne-resize) | Resize from top-right corner |
| E handle | → (e-resize) | Resize from right edge |
| SE handle | ↘ (se-resize) | Resize from bottom-right corner |
| S handle | ↓ (s-resize) | Resize from bottom edge |
| SW handle | ↙ (sw-resize) | Resize from bottom-left corner |
| W handle | ← (w-resize) | Resize from left edge |
| Inside selection | ✥ (move) | Move entire selection |
| Outside selection | + (default) | Create new selection |

## Keyboard + Mouse Combinations

Currently supported:
- **Left Click + Drag**: Create/Resize/Move selection
- **Right Click + Drag**: Pan image (existing feature)
- **Ctrl + Mouse Wheel**: Zoom in/out (existing feature)
- **Mouse Wheel**: Navigate images (existing feature)

## Operation Priority

When multiple actions are possible, priority is:

1. **Pan** (right-click anywhere) - Highest priority
2. **Resize** (left-click on handle)
3. **Move** (left-click inside selection)
4. **Create New** (left-click outside selection) - Lowest priority

This means:
- Right-click always pans, even over selection
- Handle clicks always resize, never move or create
- Clicks inside selection always move, never create
- Only clicks outside selection create new

## State Transitions

```
No Selection → (Click+Drag outside) → Creating Selection → (Release) → Has Selection
                                                                            │
                Has Selection → (Click handle) → Resizing ──→ (Release) ───┤
                     │                                                      │
                     └→ (Click inside) → Moving ────→ (Release) ───────────┤
                     │                                                      │
                     └→ (Click outside) → Creating New (old cleared) ──────┘
```

## Example Workflows

### Workflow 1: Perfect Crop
```
1. Create initial selection around subject
2. Zoom to 200% for precision
3. Grab SE corner → drag to adjust size
4. Grab N edge → drag to adjust top
5. Click inside → drag to perfect position
6. Press Alt+C to crop
```

### Workflow 2: Blur Face
```
1. Create selection around face
2. Grab handles to resize to exact fit
3. Click inside if needed to reposition
4. Press Alt+B to blur
```

### Workflow 3: Copy Detail
```
1. Zoom to detail area (300%)
2. Create rough selection
3. Fine-tune with corner handles
4. Adjust edges with edge handles
5. Press Ctrl+C to copy
```

## Tips & Tricks

### Precision Resizing
- Zoom in first for pixel-perfect precision
- Use edge handles for one-axis resize
- Use corner handles for proportional resize

### Quick Adjustments
- Don't delete and recreate - just resize/move
- Resize is faster than recreating from scratch
- Use handles for fine-tuning after rough selection

### Large Selections
- Create rough selection at low zoom
- Zoom in and use handles for edges
- Move to reposition if needed

### Small Selections
- Zoom to 300-400% first
- Create initial selection
- Use handles to fine-tune to single pixels

## Coordinate System

All operations work in **image space**:
- Selection remembers position relative to image pixels
- Works correctly at any zoom level
- Transforms properly when panning
- Resize/move precision independent of viewport

Example:
```
Image: 2000x1500px
Selection: {x: 100, y: 100, width: 200, height: 150}

At 50% zoom:  Selection appears 100x75px on screen
At 100% zoom: Selection appears 200x150px on screen
At 200% zoom: Selection appears 400x300px on screen

But always represents same 200x150px area of source image!
```

## Handle Size Scaling

Handles are **fixed size** in viewport (always 8x8px):
- At 50% zoom: Handles cover ~16x16px of image
- At 100% zoom: Handles cover ~8x8px of image  
- At 200% zoom: Handles cover ~4x4px of image
- At 400% zoom: Handles cover ~2x2px of image

This means handles are:
- ✓ Always easy to click (constant screen size)
- ✓ More precise at higher zoom (smaller image area)
- ✓ Visible at all zoom levels

## Integration with Existing Features

All existing selection-based features work with resize/move:

| Feature | Shortcut | Works After Resize/Move |
|---------|----------|-------------------------|
| Crop to Selection | Alt+C | ✓ Yes |
| Copy Selection | Ctrl+C | ✓ Yes |
| Blur (Light) | - | ✓ Yes |
| Blur (Medium) | Alt+B | ✓ Yes |
| Blur (Strong) | - | ✓ Yes |

Plus all filters/adjustments that support selections:
- Grayscale, Invert, Sepia, Sharpen, etc.
- Brightness/Contrast, Saturation, Hue Shift, Posterize
