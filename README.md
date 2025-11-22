# image-editor

A feature-rich image viewer and editor for Pulsar. View, edit, and transform images directly in your editor with support for cropping, rotation, flipping, color adjustments, filters, and more.

## Installation

To install `image-editor` search for [image-editor](https://web.pulsar-edit.dev/packages/image-editor) in the Install pane of the Pulsar settings or run `ppm install image-editor`. Alternatively, you can run `ppm install asiloisad/pulsar-image-editor` to install a package directly from the GitHub repository.

## Features

### Viewing & Navigation
- **Zoom Controls**: Zoom in/out, reset zoom, zoom to fit, zoom to 100%
- **Pan & Navigate**: Right-click drag to pan, arrow keys to scroll
- **Image Browsing**: Navigate between images in the same folder using wheel scroll or arrow buttons
- **Background Options**: Toggle between white, black, transparent, and native backgrounds
- **Color Inversion**: Reverse colors for better visibility (CSS-based toggle)

### Transform Operations
- **Rotate 90° Clockwise** (`Ctrl+]` / `Cmd+]`)
- **Rotate 90° Counter-clockwise** (`Ctrl+[` / `Cmd+[`)
- **Rotate 180°** (`Ctrl+Shift+R` / `Cmd+Shift+R`)
- **Flip Horizontal** (`Ctrl+H` / `Cmd+H`)
- **Flip Vertical** (`Ctrl+Shift+H` / `Cmd+Shift+H`)

### Color & Tone Adjustments
- **Brightness & Contrast** - Adjustable sliders for fine-tuned control
- **Saturation** - Increase or decrease color intensity
- **Hue Shift** - Rotate the color spectrum (0-360°)
- **Grayscale** (`Ctrl+Shift+G` / `Cmd+Shift+G`) - Convert to black & white
- **Invert Colors** (`Ctrl+I` / `Cmd+I`) - Permanently invert all colors
- **Sepia Tone** - Apply vintage sepia effect
- **Posterize** - Reduce color levels for artistic effect

### Filters
- **Create Selections**: Left-click and drag to create a selection rectangle
- **Copy to Clipboard** (`Ctrl+C` / `Cmd+C`): Copy the selected area
- **Crop to Selection** (`Alt+C`): Crop the image to the selected area
- **Blur Selection** (`Alt+B` for medium): Apply blur effect with three intensity levels:
  - Light blur
  - Medium blur
  - Strong blur
- **Sharpen** - Enhance image detail with three intensity levels:
  - Light sharpen
  - Medium sharpen
  - Strong sharpen

### File Operations
- **Save** (`Ctrl+S` / `Cmd+S`): Save changes to the current file
- **Save As** (`Ctrl+Shift+S` / `Cmd+Shift+S`): Save to a new location
- **Auto-reload**: Images automatically update when modified externally

### Undo/Redo
- **Undo** (`Ctrl+Z` / `Cmd+Z`): Revert to previous state
- **Redo** (`Ctrl+Y` or `Ctrl+Shift+Z` / `Cmd+Y` or `Cmd+Shift+Z`): Restore next state
- **History**: Up to 20 previous states maintained
- **Position tracking**: Shows current position in history (e.g., "3/10")
- **Viewport preservation**: Restores image position and zoom level with each undo/redo
- **Non-linear**: Creating new changes from middle of history removes forward states

### Navigation
- Arrow keys: Scroll image
- Page Up/Down: Scroll by page
- Home/End: Scroll to top/bottom
- Mouse wheel (no Ctrl): Navigate to previous/next image
- Mouse wheel (with Ctrl): Zoom in/out at cursor position

### File Operations
- `Ctrl/Cmd + S`: Save
- `Ctrl/Cmd + Shift + S`: Save As

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
