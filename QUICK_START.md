# Quick Start: Using Selection Resize and Move

## Basic Usage

### Create a Selection
1. Left-click and drag on the image
2. Release to finish
3. You'll see a selection box with 8 small handles

### Resize the Selection
1. Hover over any handle (corner or edge)
2. Cursor changes to show resize direction
3. Click and drag to resize
4. Release to finish

**Handle positions:**
```
┌─■─────────■─────────■─┐
│ NW      N         NE │
■                      ■
│ W              E     │
■                      ■
│ SW      S         SE │
└─■─────────■─────────■─┘
```

### Move the Selection
1. Click **inside** the selection (not on a handle)
2. Drag to new position
3. Release to finish

### Clear and Start Over
1. Click **outside** the selection
2. Old selection clears
3. Drag to create new selection

## Common Tasks

### Crop with Precise Selection
```
1. Create rough selection
2. Zoom in (Ctrl/Cmd + +)
3. Drag corner handles to exact size
4. Click inside and drag to perfect position
5. Alt+C to crop
```

### Blur Specific Area
```
1. Create selection around area
2. Resize with handles to exact fit
3. Move if needed
4. Alt+B to blur
```

### Copy Exact Detail
```
1. Zoom to detail (Ctrl/Cmd + +)
2. Create selection
3. Fine-tune with corner handles
4. Ctrl/Cmd + C to copy
```

## Tips

**For Precision:**
- Zoom in before resizing (200-400%)
- Use corner handles for diagonal resize
- Use edge handles for single-axis resize

**For Speed:**
- Rough selection at low zoom
- Zoom in and fine-tune with handles
- Much faster than recreating

**For Control:**
- Selection follows image when panning
- Selection scales when zooming
- Always stays on same image pixels

## Remember

✓ **Inside click** = Move the selection  
✓ **Handle click** = Resize the selection  
✓ **Outside click** = Create new selection  
✓ **Right-click** = Pan the image (as before)  

## Keyboard Shortcuts (Unchanged)

These still work with resized/moved selections:
- `Alt+C` - Crop to selection
- `Ctrl/Cmd+C` - Copy selection
- `Alt+B` - Blur selection (medium)
- `Ctrl/Cmd+Z` - Undo
- `Ctrl/Cmd+S` - Save

## Visual Feedback

Watch for cursor changes:
- **Move cursor** (✥) = Inside selection, can move
- **Resize cursors** (↔↕↖↗) = On handle, can resize
- **Default cursor** (+) = Outside, can create new
- **Grab cursor** (✊) = Right-click, can pan

## That's It!

Just three simple actions:
1. **Drag handles** to resize
2. **Drag inside** to move  
3. **Drag outside** to create new

Everything else works just like before!
