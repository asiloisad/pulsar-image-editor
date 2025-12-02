# image-editor

A feature-rich image viewer and editor for Pulsar. View, edit, and transform images directly in your editor with support for cropping, rotation, flipping, color adjustments, filters, and more.

## Installation

To install `image-editor` search for [image-editor](https://web.pulsar-edit.dev/packages/image-editor) in the Install pane of the Pulsar settings or run `ppm install image-editor`. Alternatively, you can run `ppm install asiloisad/pulsar-image-editor` to install a package directly from the GitHub repository.

## Features

### Viewing & Navigation
- **Zoom Controls**: Zoom in (`+`/`=`), zoom out (`-`/`_`), reset to 100% (`7`), zoom to fit (`9`), zoom to 100% max (`0`)
- **Pan & Navigate**: Right-click drag to pan, arrow keys to scroll, center image (`8`)
- **Image Browsing**: Navigate between images in the same folder using mouse wheel, `PageUp`/`PageDown`, or `Home`/`End` for first/last
- **Background Options**: Toggle between white, black, transparent, and native backgrounds
- **Color Inversion**: Reverse colors for better visibility (CSS-based toggle, does not affect saved image)

### Transform Operations
- **Rotate 90° Clockwise** (`]`)
- **Rotate 90° Counter-clockwise** (`[`)
- **Rotate 180°**
- **Free Rotate** - Rotate by any angle with live preview
- **Flip Horizontal** (`H`)
- **Flip Vertical** (`V`)
- **Resize** - Resize image with aspect ratio lock and percentage presets

### Color & Tone Adjustments
- **Auto Adjust Colors** - Automatic color level optimization
- **Brightness & Contrast** - Adjustable sliders for fine-tuned control
- **Saturation** - Increase or decrease color intensity
- **Hue Shift** - Rotate the color spectrum (0-360°)
- **Grayscale** (`G`) - Convert to black & white
- **Invert Colors** (`I`) - Permanently invert all colors
- **Sepia Tone** - Apply vintage sepia effect
- **Posterize** - Reduce color levels for artistic effect

### Filters
- **Blur** (`B` for medium) - Apply Gaussian blur with three preset levels or custom radius
- **Sharpen** (`S` for medium) - Enhance image detail with three preset levels or custom strength

### Selection Tools
- **Create Selections**: Left-click and drag to create a selection rectangle
- **Resize Selection**: Drag corners or edges to adjust selection size
- **Auto Select** (`A`) - Automatically detect and select content by background color
- **Auto Select with Border** (`Q`) - Auto select with 2% border padding
- **Select All** - Select the entire image
- **Select Visible Area** (`W`) - Select only the visible portion of the image
- **Copy to Clipboard** (`C`) - Copy the selected area
- **Crop to Selection** (`X`) - Crop the image to the selected area
- **Hide Selection** (`Escape`) - Clear the current selection

### File Operations
- **Save** (`Ctrl/Cmd+S`) - Save changes to the current file
- **Save As** (`Ctrl/Cmd+Shift+S`) - Save to a new location
- **Move** (`M`) - Move file to a different location
- **Duplicate** (`D`) - Create a copy of the current file
- **Edit in Paint** - Open image in Windows Paint (Windows only)
- **Show Properties** - View detailed file and image information
- **Auto-reload** - Images automatically update when modified externally

### Undo/Redo
- **Undo** (`Z`) - Revert to previous state
- **Redo** (`Y`) - Restore next state
- **History** - Configurable history size (default 50, auto-reduced for large images)
- **Viewport preservation** - Restores image position and zoom level with each undo/redo

### Mouse Controls
- **Left-click drag**: Create selection
- **Right-click drag**: Pan image
- **Mouse wheel**: Navigate to previous/next image
- **Ctrl + Mouse wheel**: Zoom in/out at cursor position

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback's welcome!
