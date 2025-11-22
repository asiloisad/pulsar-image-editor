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
- **Sharpen** - Enhance image detail with three intensity levels:
  - Light sharpen
  - Medium sharpen
  - Strong sharpen

### Selection-Based Editing
- **Create Selections**: Left-click and drag to create a selection rectangle
- **Copy to Clipboard** (`Ctrl+C` / `Cmd+C`): Copy the selected area
- **Crop to Selection** (`Alt+C`): Crop the image to the selected area
- **Blur Selection** (`Alt+B` for medium): Apply blur effect with three intensity levels:
  - Light blur
  - Medium blur
  - Strong blur

### File Operations
- **Save** (`Ctrl+S` / `Cmd+S`): Save changes to the current file
- **Save As** (`Ctrl+Shift+S` / `Cmd+Shift+S`): Save to a new location
- **Auto-reload**: Images automatically update when modified externally

## Keyboard Shortcuts

### Zoom & View
- `Ctrl/Cmd + +` or `Ctrl/Cmd + =`: Zoom in
- `Ctrl/Cmd + -`: Zoom out
- `Ctrl/Cmd + 0`: Reset zoom to 100%
- `Ctrl/Cmd + 8`: Center image
- `Ctrl/Cmd + 9`: Zoom to fit
- `Ctrl/Cmd + R`: Reload image

### Transform
- `Ctrl/Cmd + ]`: Rotate 90° clockwise
- `Ctrl/Cmd + [`: Rotate 90° counter-clockwise
- `Ctrl/Cmd + Shift + R`: Rotate 180°
- `Ctrl/Cmd + H`: Flip horizontal
- `Ctrl/Cmd + Shift + H`: Flip vertical

### Color & Adjustments
- `Ctrl/Cmd + Shift + G`: Grayscale
- `Ctrl/Cmd + I`: Invert colors

### Selection & Editing
- `Ctrl/Cmd + C`: Copy selection to clipboard
- `Alt + C`: Crop to selection
- `Alt + B`: Blur selection (medium)

### Navigation
- Arrow keys: Scroll image
- Page Up/Down: Scroll by page
- Home/End: Scroll to top/bottom
- Mouse wheel (no Ctrl): Navigate to previous/next image
- Mouse wheel (with Ctrl): Zoom in/out at cursor position

### File Operations
- `Ctrl/Cmd + S`: Save
- `Ctrl/Cmd + Shift + S`: Save As

## Menus

Access all features through:
- **Main Menu**: Packages → Image Editor
- **Context Menu**: Right-click on any image

Both menus are organized into logical sections:
- **Transform**: Rotation and flipping operations
- **Adjustments**: Color and tone adjustments
- **Filters**: Sharpen and other effects
- **Selection**: Selection-based operations

## Configuration

### Default Background Color
Choose the default background for transparent images:
- White
- Black
- Transparent (checkerboard pattern)
- Native (system default)

### Success Message Notifications
Control which operations show success notifications:
- **Crop**: Show message after cropping
- **Blur**: Show message after blurring
- **Save**: Show message after saving
- **Transform**: Show message after rotating or flipping
- **Adjustment**: Show message after color/tone adjustments and filters
- **Clipboard**: Show message after copying to clipboard

Access these settings in: **Settings → Packages → image-editor → Settings**

## Tips

### Working with Selections
- **Creating Selections**: Left-click and drag to create a selection rectangle. Click outside to clear it.
- **Copy Before Crop**: Use `Ctrl+C` to copy your selection before cropping if you want to preserve the original.
- **Precise Selection**: Zoom in for more precise selection control.

### Color Adjustments
- **Interactive Dialogs**: Adjustments like Brightness/Contrast, Saturation, Hue Shift, and Posterize show interactive dialogs with sliders.
- **Real-time Preview**: Move sliders to see different values before applying.
- **Multiple Adjustments**: Apply multiple adjustments sequentially for complex effects.

### Workflow Tips
- **Panning**: Right-click and drag to pan around zoomed images.
- **Quick Navigation**: Use mouse wheel (without Ctrl) to quickly browse through images in a folder.
- **Batch Workflow**: Make edits, save, then use wheel scroll to move to the next image.
- **Non-destructive**: All edits are non-destructive until you save. Use "Reload Image" to revert.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
