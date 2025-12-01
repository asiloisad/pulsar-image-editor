const fs = require("fs");
const path = require("path");
const { Emitter, CompositeDisposable, Disposable } = require("atom");
const etch = require("etch");
const $ = etch.dom;

module.exports = class ImageEditorView {
  constructor(editor) {
    this.editor = editor;
    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.imageSize = fs.statSync(this.editor.getPath()).size;
    this.loaded = false;
    this.levels = [
      0.05,
      0.1,
      0.25,
      0.5,
      0.75,
      1.0,
      1.25,
      1.5,
      2,
      3,
      4,
      5,
      7.5,
      10,
    ];
    this.zoom = 1.0;
    this.step = null;
    this.auto = false;
    this.translateX = 0;
    this.translateY = 0;
    // Fixed origin point - set when image first loads, never changes
    this.originX = 0;
    this.originY = 0;
    this.panning = false;
    this.selecting = false;
    this.resizing = false;
    this.resizeHandle = null; // Which handle is being dragged: nw, n, ne, e, se, s, sw, w
    this.moving = false;
    this.moveStartMouse = { x: 0, y: 0 };
    this.moveStartSelection = { x1: 0, y1: 0, x2: 0, y2: 0 };
    // Store selection in image space (not viewport space)
    this.selectionStartImg = { x: 0, y: 0 };
    this.selectionEndImg = { x: 0, y: 0 };
    this.isSaving = false;

    // Undo/Redo history
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = atom.config.get("image-editor.maxHistorySize") || 50;
    this.lastModifiedState = false; // Track last modified state for change detection
    this.loadingAbortController = null; // Track current loading operation

    // Performance optimizations
    this.preloadCache = new Map(); // Cache for preloaded images
    this.canvasPool = []; // Reusable canvas elements
    this.maxCanvasPoolSize = 3;
    this.lastWheelTime = 0;
    this.wheelDebounceDelay =
      atom.config.get("image-editor.wheelNavigationDelay") || 150;

    // File navigation cache
    this.fileListCache = {
      directory: null,
      files: [],
      currentIndex: -1,
      extensions: [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"],
    };

    etch.initialize(this);

    this.defaultBackgroundColor = atom.config.get(
      "image-editor.defaultBackgroundColor"
    );
    this.refs.imageContainer.setAttribute(
      "background",
      this.defaultBackgroundColor
    );

    this.refs.image.style.display = "none";
    this.updateImageURI();

    this.updateImageURI();

    this.disposables.add(
      this.editor.onDidReplaceFile(() => this.updateImageURI())
    );
    this.disposables.add(this.editor.onDidChange(() => this.updateImageURI()));
    this.disposables.add(
      atom.commands.add(this.element, {
        "image-editor:reload": () => this.updateImageURI(),
        "image-editor:zoom-in": () => this.zoomIn(),
        "image-editor:zoom-out": () => this.zoomOut(),
        "image-editor:reset-zoom": () => this.resetZoom(),
        "image-editor:zoom-to-fit": () => this.zoomToFit(),
        "image-editor:zoom-to-100": () => this.zoomTo100(),
        "image-editor:center": () => this.centerImage(),
        "image-editor:next-image": () => this.nextImage(),
        "image-editor:previous-image": () => this.previousImage(),
        "image-editor:first-image": () => this.firstImage(),
        "image-editor:last-image": () => this.lastImage(),
        "core:move-up": () => this.scrollUp(),
        "core:move-down": () => this.scrollDown(),
        "core:move-left": () => this.scrollLeft(),
        "core:move-right": () => this.scrollRight(),
        "core:page-up": () => this.pageUp(),
        "core:page-down": () => this.pageDown(),
        "core:move-to-top": () => this.scrollToTop(),
        "core:move-to-bottom": () => this.scrollToBottom(),
        "image-editor:crop-to-selection": () => this.cropToSelection(),
        "image-editor:blur-light": () => this.blurImage(6),
        "image-editor:blur-medium": () => this.blurImage(12),
        "image-editor:blur-strong": () => this.blurImage(20),
        "image-editor:blur": () => this.showBlurDialog(),
        "image-editor:rotate-90-cw": () => this.rotate(90),
        "image-editor:rotate-90-ccw": () => this.rotate(-90),
        "image-editor:rotate-180": () => this.rotate(180),
        "image-editor:flip-horizontal": () => this.flipHorizontal(),
        "image-editor:flip-vertical": () => this.flipVertical(),
        "image-editor:grayscale": () => this.applyGrayscale(),
        "image-editor:invert-colors": () => this.invertColors(),
        "image-editor:sepia": () => this.applySepia(),
        "image-editor:sharpen-light": () => this.sharpenImage(0.5),
        "image-editor:sharpen-medium": () => this.sharpenImage(1.0),
        "image-editor:sharpen-strong": () => this.sharpenImage(1.5),
        "image-editor:sharpen": () => this.showSharpenDialog(),
        "image-editor:brightness-contrast": () =>
          this.showBrightnessContrastDialog(),
        "image-editor:saturation": () => this.showSaturationDialog(),
        "image-editor:hue-shift": () => this.showHueShiftDialog(),
        "image-editor:posterize": () => this.showPosterizeDialog(),
        "image-editor:auto-adjust-colors": () => this.autoAdjustColors(),
        "image-editor:copy-selection": () => this.copySelectionToClipboard(),
        "image-editor:auto-select": () => this.autoSelect(),
        "image-editor:auto-select-with-border": () => this.autoSelect(2),
        "image-editor:select-all": () => this.selectAll(),
        "image-editor:select-visible-area": () => this.selectVisibleArea(),
        "image-editor:show-properties": () => this.showPropertiesDialog(),
        "image-editor:undo": () => this.undo(),
        "image-editor:redo": () => this.redo(),
        "image-editor:hide-selection": () => this.hideSelection(),
      })
    );

    this.disposables.add(
      atom.tooltips.add(this.refs.whiteTransparentBackgroundButton, {
        title: "Use white transparent background",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.blackTransparentBackgroundButton, {
        title: "Use black transparent background",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.transparentTransparentBackgroundButton, {
        title: "Use transparent background",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.nativeBackgroundButton, {
        title: "Use native background",
      })
    );

    // Add tooltips for navigation buttons
    this.disposables.add(
      atom.tooltips.add(this.refs.firstImageButton, {
        title: "Navigate to the first image in the current directory",
        keyBindingCommand: "image-editor:first-image",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.prevImageButton, {
        title: "Navigate to the previous image",
        keyBindingCommand: "image-editor:previous-image",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.undoButton, {
        title: "Undo last change",
        keyBindingCommand: "image-editor:undo",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.redoButton, {
        title: "Redo last undone change",
        keyBindingCommand: "image-editor:redo",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.nextImageButton, {
        title: "Navigate to the next image",
        keyBindingCommand: "image-editor:next-image",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.lastImageButton, {
        title: "Navigate to the last image in the current directory",
        keyBindingCommand: "image-editor:last-image",
      })
    );

    // Add tooltips for zoom buttons
    this.disposables.add(
      atom.tooltips.add(this.refs.zoomOutButton, {
        title: "Decrease zoom level",
        keyBindingCommand: "image-editor:zoom-out",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.resetZoomButton, {
        title: "Reset zoom to default",
        keyBindingCommand: "image-editor:reset-zoom",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.zoomInButton, {
        title: "Increase zoom level",
        keyBindingCommand: "image-editor:zoom-in",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.centerButton, {
        title: "Center the image within the pane",
        keyBindingCommand: "image-editor:center",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.zoomToFitButton, {
        title: "Scale image to fit the window",
        keyBindingCommand: "image-editor:zoom-to-fit",
      })
    );
    this.disposables.add(
      atom.tooltips.add(this.refs.zoomTo100Button, {
        title: "Scale image to fit, but not more than 100%",
        keyBindingCommand: "image-editor:zoom-to-100",
      })
    );

    const clickHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.changeBackground(event.target.value);
    };

    this.refs.whiteTransparentBackgroundButton.addEventListener(
      "click",
      clickHandler
    );
    this.disposables.add(
      new Disposable(() => {
        this.refs.whiteTransparentBackgroundButton.removeEventListener(
          "click",
          clickHandler
        );
      })
    );
    this.refs.blackTransparentBackgroundButton.addEventListener(
      "click",
      clickHandler
    );
    this.disposables.add(
      new Disposable(() => {
        this.refs.blackTransparentBackgroundButton.removeEventListener(
          "click",
          clickHandler
        );
      })
    );
    this.refs.transparentTransparentBackgroundButton.addEventListener(
      "click",
      clickHandler
    );
    this.disposables.add(
      new Disposable(() => {
        this.refs.transparentTransparentBackgroundButton.removeEventListener(
          "click",
          clickHandler
        );
      })
    );
    this.refs.nativeBackgroundButton.addEventListener("click", clickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.nativeBackgroundButton.removeEventListener(
          "click",
          clickHandler
        );
      })
    );

    const zoomInClickHandler = () => {
      this.zoomIn();
    };
    this.refs.zoomInButton.addEventListener("click", zoomInClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.zoomInButton.removeEventListener("click", zoomInClickHandler);
      })
    );

    const zoomOutClickHandler = () => {
      this.zoomOut();
    };
    this.refs.zoomOutButton.addEventListener("click", zoomOutClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.zoomOutButton.removeEventListener(
          "click",
          zoomOutClickHandler
        );
      })
    );

    const resetZoomClickHandler = () => {
      this.resetZoom();
    };
    this.refs.resetZoomButton.addEventListener("click", resetZoomClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.resetZoomButton.removeEventListener(
          "click",
          resetZoomClickHandler
        );
      })
    );

    const undoClickHandler = () => {
      this.undo();
    };
    this.refs.undoButton.addEventListener("click", undoClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.undoButton.removeEventListener("click", undoClickHandler);
      })
    );

    const redoClickHandler = () => {
      this.redo();
    };
    this.refs.redoButton.addEventListener("click", redoClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.redoButton.removeEventListener("click", redoClickHandler);
      })
    );

    const prevImageClickHandler = () => {
      this.previousImage();
    };
    this.refs.prevImageButton.addEventListener("click", prevImageClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.prevImageButton.removeEventListener(
          "click",
          prevImageClickHandler
        );
      })
    );

    const firstImageClickHandler = () => {
      this.firstImage();
    };
    this.refs.firstImageButton.addEventListener(
      "click",
      firstImageClickHandler
    );
    this.disposables.add(
      new Disposable(() => {
        this.refs.firstImageButton.removeEventListener(
          "click",
          firstImageClickHandler
        );
      })
    );

    const nextImageClickHandler = () => {
      this.nextImage();
    };
    this.refs.nextImageButton.addEventListener("click", nextImageClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.nextImageButton.removeEventListener(
          "click",
          nextImageClickHandler
        );
      })
    );

    const lastImageClickHandler = () => {
      this.lastImage();
    };
    this.refs.lastImageButton.addEventListener("click", lastImageClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.lastImageButton.removeEventListener(
          "click",
          lastImageClickHandler
        );
      })
    );

    const centerClickHandler = () => {
      this.centerImage();
    };
    this.refs.centerButton.addEventListener("click", centerClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.centerButton.removeEventListener("click", centerClickHandler);
      })
    );

    const zoomToFitClickHandler = () => {
      this.zoomToFit();
    };
    this.refs.zoomToFitButton.addEventListener("click", zoomToFitClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.zoomToFitButton.removeEventListener(
          "click",
          zoomToFitClickHandler
        );
      })
    );

    const zoomTo100ClickHandler = () => {
      this.zoomTo100();
    };
    this.refs.zoomTo100Button.addEventListener("click", zoomTo100ClickHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.zoomTo100Button.removeEventListener(
          "click",
          zoomTo100ClickHandler
        );
      })
    );

    const wheelContainerHandler = (event) => {
      if (event.ctrlKey) {
        event.stopPropagation();
        const factor = event.wheelDeltaY > 0 ? 1.2 / 1 : 1 / 1.2;
        this.zoomToMousePosition(factor * this.zoom, event);
      } else {
        // Improved debouncing for navigation
        const now = Date.now();
        if (
          this.lastWheelTime &&
          now - this.lastWheelTime < this.wheelDebounceDelay
        ) {
          event.preventDefault();
          return;
        }
        this.lastWheelTime = now;

        event.preventDefault();
        if (event.wheelDeltaY < 0) {
          this.nextImage();
        } else if (event.wheelDeltaY > 0) {
          this.previousImage();
        }
      }
    };
    this.refs.imageContainer.addEventListener("wheel", wheelContainerHandler);
    this.disposables.add(
      new Disposable(() => {
        this.refs.imageContainer.removeEventListener(
          "wheel",
          wheelContainerHandler
        );
      })
    );

    this.resizeObserver = new ResizeObserver(() => {
      if (this.auto === 1) {
        this.zoomTo100();
      } else if (this.auto) {
        this.zoomToFit();
      }
    });
    this.resizeObserver.observe(this.refs.imageContainer);

    this.mouseMoveHandler = (event) => {
      if (this.panning) {
        this.panDistance +=
          Math.abs(event.movementX) + Math.abs(event.movementY);
        if (this.panDistance > 5) {
          this.panMoved = true;
          this.disableAutoZoom();
        }
        this.translateX += event.movementX;
        this.translateY += event.movementY;
        this.updateTransform();
        // Update selection box position if there's an active selection
        if (this.refs.selectionBox.style.display === "block") {
          this.updateSelectionBox();
        }
      } else if (this.moving) {
        const rect = this.refs.imageContainer.getBoundingClientRect();
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;
        const imgX = (viewportX - this.translateX) / this.zoom;
        const imgY = (viewportY - this.translateY) / this.zoom;

        // Calculate delta in image space
        const deltaX = imgX - this.moveStartMouse.x;
        const deltaY = imgY - this.moveStartMouse.y;

        // Update selection position
        this.selectionStartImg.x = this.moveStartSelection.x1 + deltaX;
        this.selectionStartImg.y = this.moveStartSelection.y1 + deltaY;
        this.selectionEndImg.x = this.moveStartSelection.x2 + deltaX;
        this.selectionEndImg.y = this.moveStartSelection.y2 + deltaY;

        this.updateSelectionBox();
      } else if (this.resizing) {
        const rect = this.refs.imageContainer.getBoundingClientRect();
        // Convert viewport coordinates to image space
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;
        const imgX = (viewportX - this.translateX) / this.zoom;
        const imgY = (viewportY - this.translateY) / this.zoom;

        // Update the appropriate corner/edge based on which handle is being dragged
        const handle = this.resizeHandle;

        // Determine which coordinates to update based on handle
        if (handle.includes("n")) {
          this.selectionStartImg.y = imgY;
        }
        if (handle.includes("s")) {
          this.selectionEndImg.y = imgY;
        }
        if (handle.includes("w")) {
          this.selectionStartImg.x = imgX;
        }
        if (handle.includes("e")) {
          this.selectionEndImg.x = imgX;
        }

        this.updateSelectionBox();
      } else if (this.selecting) {
        const rect = this.refs.imageContainer.getBoundingClientRect();
        // Convert viewport coordinates to image space
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;
        this.selectionEndImg = {
          x: (viewportX - this.translateX) / this.zoom,
          y: (viewportY - this.translateY) / this.zoom,
        };
        this.updateSelectionBox();
      }

      // Track and emit mouse position in image space
      if (this.loaded && this.refs.image) {
        const rect = this.refs.imageContainer.getBoundingClientRect();
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;
        const imgX = Math.round((viewportX - this.translateX) / this.zoom);
        const imgY = Math.round((viewportY - this.translateY) / this.zoom);

        // Only emit if coordinates are within image bounds
        if (
          imgX >= 0 &&
          imgX < this.refs.image.naturalWidth &&
          imgY >= 0 &&
          imgY < this.refs.image.naturalHeight
        ) {
          this.emitter.emit("mouse-position", { imgX, imgY });
        } else {
          this.emitter.emit("mouse-position", { imgX: null, imgY: null });
        }
      }
    };
    this.mouseDownHandler = (event) => {
      if (event.button === 2) {
        // Right click
        this.panning = true;
        this.panMoved = false;
        this.panDistance = 0;
        this.refs.imageContainer.classList.add("grabbing");
        this.refs.imageContainer.style.cursor = "grab";
      } else if (event.button === 0) {
        // Left click
        // Don't start new selection if clicking on a resize handle
        if (event.target.classList.contains("selection-handle")) {
          return;
        }

        // Check if clicking inside existing selection
        const hasSelection = this.refs.selectionBox.style.display === "block";
        if (hasSelection) {
          const rect = this.refs.imageContainer.getBoundingClientRect();
          const viewportX = event.clientX - rect.left;
          const viewportY = event.clientY - rect.top;
          const imgX = (viewportX - this.translateX) / this.zoom;
          const imgY = (viewportY - this.translateY) / this.zoom;

          const minX = Math.min(
            this.selectionStartImg.x,
            this.selectionEndImg.x
          );
          const maxX = Math.max(
            this.selectionStartImg.x,
            this.selectionEndImg.x
          );
          const minY = Math.min(
            this.selectionStartImg.y,
            this.selectionEndImg.y
          );
          const maxY = Math.max(
            this.selectionStartImg.y,
            this.selectionEndImg.y
          );

          // If clicking inside selection, start moving it
          if (imgX >= minX && imgX <= maxX && imgY >= minY && imgY <= maxY) {
            this.moving = true;
            this.moveStartMouse = { x: imgX, y: imgY };
            this.moveStartSelection = {
              x1: this.selectionStartImg.x,
              y1: this.selectionStartImg.y,
              x2: this.selectionEndImg.x,
              y2: this.selectionEndImg.y,
            };
            return;
          }

          // Clicking outside - clear selection and start new
          this.setSelectionVisibility(false);
        }

        const rect = this.refs.imageContainer.getBoundingClientRect();
        this.selecting = true;
        // Convert viewport coordinates to image space
        const viewportX = event.clientX - rect.left;
        const viewportY = event.clientY - rect.top;
        this.selectionStartImg = {
          x: (viewportX - this.translateX) / this.zoom,
          y: (viewportY - this.translateY) / this.zoom,
        };
        this.selectionEndImg = { ...this.selectionStartImg };
        this.setSelectionVisibility(true);
        this.updateSelectionBox();
      }
    };
    this.mouseUpHandler = () => {
      if (this.panning) {
        this.panning = false;
        this.refs.imageContainer.classList.remove("grabbing");
        this.refs.imageContainer.style.cursor = "default";
      } else if (this.moving) {
        this.moving = false;
        // Normalize selection after moving
        const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
        const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x);
        const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
        const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y);

        this.selectionStartImg = { x: minX, y: minY };
        this.selectionEndImg = { x: maxX, y: maxY };
        this.updateSelectionBox();
      } else if (this.resizing) {
        this.resizing = false;
        this.resizeHandle = null;

        // Normalize selection (ensure start is top-left, end is bottom-right)
        const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
        const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x);
        const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
        const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y);

        this.selectionStartImg = { x: minX, y: minY };
        this.selectionEndImg = { x: maxX, y: maxY };

        // Check if selection has any size
        const selWidth = maxX - minX;
        const selHeight = maxY - minY;
        const minSize = 3 / this.zoom;
        if (selWidth < minSize && selHeight < minSize) {
          this.refs.selectionBox.style.display = "none";
        }

        this.updateSelectionBox();
      } else if (this.selecting) {
        this.selecting = false;
        // Check if selection has any size (was dragged) - check in image space
        const selWidth = Math.abs(
          this.selectionEndImg.x - this.selectionStartImg.x
        );
        const selHeight = Math.abs(
          this.selectionEndImg.y - this.selectionStartImg.y
        );
        // If selection is too small (just a click), hide it
        const minSize = 3 / this.zoom; // Minimum size in image space
        if (selWidth < minSize && selHeight < minSize) {
          this.refs.selectionBox.style.display = "none";
        }
        // Otherwise keep selection box visible
      }
    };

    this.contextMenuHandler = (event) => {
      if (this.panMoved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    this.refs.imageContainer.addEventListener(
      "mousedown",
      this.mouseDownHandler
    );
    this.refs.imageContainer.addEventListener(
      "contextmenu",
      this.contextMenuHandler
    );
    window.addEventListener("mousemove", this.mouseMoveHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);

    this.disposables.add(
      new Disposable(() => {
        this.refs.imageContainer.removeEventListener(
          "mousedown",
          this.mouseDownHandler
        );
        this.refs.imageContainer.removeEventListener(
          "contextmenu",
          this.contextMenuHandler
        );
        window.removeEventListener("mousemove", this.mouseMoveHandler);
        window.removeEventListener("mouseup", this.mouseUpHandler);
      })
    );

    // Add resize handle listeners
    this.setupResizeHandles();
  }

  onDidLoad(callback) {
    return this.emitter.on("did-load", callback);
  }

  onMousePosition(callback) {
    return this.emitter.on("mouse-position", callback);
  }

  update() {}

  destroy() {
    this.disposables.dispose();
    this.emitter.dispose();
    this.resizeObserver.disconnect();

    // Clean up performance optimizations
    this.preloadCache.clear();
    this.canvasPool.forEach((canvas) => (canvas.width = canvas.height = 0));
    this.canvasPool = [];

    etch.destroy(this);
  }

  setupResizeHandles() {
    // Corner handles
    const corners = ["nw", "ne", "se", "sw"];
    corners.forEach((handle) => {
      const refName = "handle" + handle.toUpperCase();
      const element = this.refs[refName];

      const handleMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.resizing = true;
        this.resizeHandle = handle;
      };

      element.addEventListener("mousedown", handleMouseDown);
      this.disposables.add(
        new Disposable(() => {
          element.removeEventListener("mousedown", handleMouseDown);
        })
      );
    });

    // Edge handles (full-length borders)
    const edges = ["n", "e", "s", "w"];
    edges.forEach((edge) => {
      const refName = "edge" + edge.toUpperCase();
      const element = this.refs[refName];

      const handleMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.resizing = true;
        this.resizeHandle = edge;
      };

      element.addEventListener("mousedown", handleMouseDown);
      this.disposables.add(
        new Disposable(() => {
          element.removeEventListener("mousedown", handleMouseDown);
        })
      );
    });
  }

  render() {
    return $.div(
      { className: "image-editor", tabIndex: -1 },
      $.div(
        { className: "image-controls", ref: "imageControls" },
        $.div(
          { className: "image-controls-group image-controls-group-background" },
          $.a(
            {
              className: "image-controls-color-white",
              value: "white",
              ref: "whiteTransparentBackgroundButton",
            },
            "white"
          ),
          $.a(
            {
              className: "image-controls-color-black",
              value: "black",
              ref: "blackTransparentBackgroundButton",
            },
            "black"
          ),
          $.a(
            {
              className: "image-controls-color-transparent",
              value: "transparent",
              ref: "transparentTransparentBackgroundButton",
            },
            "transparent"
          ),
          $.a(
            {
              className: "image-controls-color-native",
              value: "native",
              ref: "nativeBackgroundButton",
            },
            "native"
          )
        ),
        $.div(
          {
            className:
              "image-controls-group image-controls-group-navigation btn-group",
          },
          $.button({ className: "btn", ref: "firstImageButton" }, "<<"),
          $.button({ className: "btn", ref: "prevImageButton" }, "<"),
          $.button({ className: "btn", ref: "undoButton" }, "↶"),
          $.button({ className: "btn", ref: "zoomOutButton" }, "-"),
          $.button(
            { className: "btn reset-zoom-button", ref: "resetZoomButton" },
            ""
          ),
          $.button({ className: "btn", ref: "zoomInButton" }, "+"),
          $.button({ className: "btn", ref: "redoButton" }, "↷"),
          $.button({ className: "btn", ref: "nextImageButton" }, ">"),
          $.button({ className: "btn", ref: "lastImageButton" }, ">>")
        ),
        $.div(
          {
            className:
              "image-controls-group image-controls-group-zoom btn-group",
          },
          $.span({
            className: "loading loading-spinner-tiny inline-block",
            ref: "loadingSpinner",
            style:
              "float: left; margin-right: 10px; margin-top: 6px; display: none;",
          }),
          $.button(
            { className: "btn center-button", ref: "centerButton" },
            "Center"
          ),
          $.button(
            { className: "btn zoom-to-fit-button", ref: "zoomToFitButton" },
            "Zoom to fit"
          ),
          $.button(
            { className: "btn zoom-to-100-button", ref: "zoomTo100Button" },
            "Zoom to 100"
          )
        )
      ),
      $.div(
        { className: "image-container", ref: "imageContainer" },
        $.img({ ref: "image" }),
        $.div({ className: "boundary-overlay", ref: "boundaryOverlay" }),
        $.div(
          { className: "selection-box", ref: "selectionBox" },
          // Edge resize bars (full length of each edge)
          $.div({ className: "selection-edge edge-n", ref: "edgeN" }),
          $.div({ className: "selection-edge edge-e", ref: "edgeE" }),
          $.div({ className: "selection-edge edge-s", ref: "edgeS" }),
          $.div({ className: "selection-edge edge-w", ref: "edgeW" }),
          // Corner handles
          $.div({ className: "selection-handle nw", ref: "handleNW" }),
          $.div({ className: "selection-handle ne", ref: "handleNE" }),
          $.div({ className: "selection-handle se", ref: "handleSE" }),
          $.div({ className: "selection-handle sw", ref: "handleSW" })
        )
      )
    );
  }

  async updateImageURI() {
    // Skip reload if we're currently saving to prevent losing the current view
    if (this.isSaving) return;

    // Cancel any pending image load
    if (this.loadingAbortController) {
      this.loadingAbortController.cancelled = true;
    }

    // Create new abort controller for this load
    this.loadingAbortController = { cancelled: false };
    const currentLoad = this.loadingAbortController;

    if (this.refs.loadingSpinner) {
      this.refs.loadingSpinner.style.display = "";
    }

    // Get file size to determine loading strategy
    try {
      this.imageSize = fs.statSync(this.editor.getPath()).size;
    } catch (e) {
      this.imageSize = 0;
    }

    const loadStartTime = Date.now();
    const imageUrl = `${this.editor.getEncodedURI()}?time=${Date.now()}`;

    // For large images, use optimized loading based on user settings
    const largeImageThreshold =
      (atom.config.get("image-editor.largeImageThreshold") || 2) * 1024 * 1024;
    const isLargeImage = this.imageSize > largeImageThreshold;

    if (isLargeImage) {
      // Update loading spinner to show file size
      const bytes = require("bytes");
    }

    // Use async/await pattern for better control
    try {
      await this.loadImageOptimized(
        imageUrl,
        isLargeImage,
        loadStartTime,
        currentLoad
      );
    } catch (error) {
      // Only show error if this load wasn't cancelled
      if (!currentLoad.cancelled) {
        // Check if this is a decode error (common during rapid navigation)
        const isDecodeError =
          error.name === "DOMException" && error.message.includes("decode");

        if (!isDecodeError) {
          console.error("Error loading image:", error);
        }

        this.loaded = false;
        if (this.refs.loadingSpinner) {
          this.refs.loadingSpinner.style.display = "none";
        }
        // Only show notification for actual errors, not decode race conditions
        if (!isDecodeError) {
          atom.notifications.addError("Failed to load image", {
            description: error.message,
            dismissable: true,
          });
        }
      }
    }
  }

  async loadImageOptimized(imageUrl, isLargeImage, loadStartTime, currentLoad) {
    return new Promise((resolve, reject) => {
      // Set image source
      this.refs.image.src = imageUrl;

      // Setup load handler
      this.refs.image.onload = async () => {
        try {
          // Check if this load was cancelled before decoding
          if (currentLoad.cancelled) {
            resolve(); // Silently resolve to avoid error
            return;
          }

          // For large images, use async decode to prevent blocking
          if (isLargeImage && this.refs.image.decode) {
            try {
              await this.refs.image.decode();
            } catch (decodeError) {
              // If decode fails (e.g., image replaced), check if cancelled
              if (currentLoad.cancelled) {
                resolve(); // Expected - image was replaced
                return;
              }
              // For decode errors, just continue - the image may still be usable
              // This commonly happens during rapid navigation
              console.warn(
                "Image decode failed, continuing without async decode:",
                decodeError.message
              );
            }
          }

          // Final check before completing load
          if (currentLoad.cancelled) {
            resolve();
            return;
          }

          this.refs.image.onload = null;
          this.originalHeight = this.refs.image.naturalHeight;
          this.originalWidth = this.refs.image.naturalWidth;
          this.loaded = true;

          // Reset transform
          this.translateX = 0;
          this.translateY = 0;

          this.zoomTo100();
          this.centerImage(); // Center initially

          this.refs.image.style.display = "";

          // Reset history when loading a new image - defer saveToHistory() until first edit
          this.history = [];
          this.historyIndex = -1;
          this.needsInitialHistorySave = true; // Flag: save initial state before first edit
          this.emitModifiedStateIfChanged();

          this.emitter.emit("did-update");
          this.emitter.emit("did-load");

          if (this.refs.loadingSpinner) {
            this.refs.loadingSpinner.style.display = "none";
          }

          // Show load time for large images
          if (isLargeImage) {
            const loadTime = Date.now() - loadStartTime;
          }

          // Always invalidate cache when loading a new image to ensure currentIndex is updated
          this.invalidateFileListCache();

          // Preload adjacent images for faster navigation
          setTimeout(() => this.preloadAdjacentImages(), 100);

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      // Setup error handler
      this.refs.image.onerror = () => {
        this.refs.image.onerror = null;
        this.loaded = false;
        if (this.refs.loadingSpinner) {
          this.refs.loadingSpinner.style.display = "none";
        }

        // Check if cancelled before rejecting
        if (currentLoad.cancelled) {
          resolve(); // Don't treat as error if cancelled
        } else {
          reject(new Error("Failed to load image"));
        }
      };
    });
  }

  onDidUpdate(callback) {
    return this.emitter.on("did-update", callback);
  }

  // Canvas pooling for better memory management
  getPooledCanvas(width, height) {
    // Try to find a suitable canvas in the pool
    const canvasIndex = this.canvasPool.findIndex(
      (c) =>
        c.width >= width &&
        c.height >= height &&
        c.width < width * 1.5 &&
        c.height < height * 1.5 // Not too oversized
    );

    if (canvasIndex !== -1) {
      const canvas = this.canvasPool.splice(canvasIndex, 1)[0];
      // Reset to exact size needed
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    // Create new canvas if pool is empty or no suitable canvas found
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  returnCanvasToPool(canvas) {
    if (this.canvasPool.length < this.maxCanvasPoolSize) {
      // Clear the canvas
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.canvasPool.push(canvas);
    } else {
      // Pool is full, let it be garbage collected
      canvas.width = canvas.height = 0;
    }
  }

  // Preload adjacent images for instant navigation
  preloadAdjacentImages() {
    if (!atom.config.get("image-editor.enablePreloading")) return;

    const nextPath = this.getAdjacentImage(1);
    const prevPath = this.getAdjacentImage(-1);

    // Preload next image with zoom calculation
    if (nextPath && !this.preloadCache.has(nextPath)) {
      this.preloadImageWithZoom(nextPath);
    }

    // Preload previous image with zoom calculation
    if (prevPath && !this.preloadCache.has(prevPath)) {
      this.preloadImageWithZoom(prevPath);
    }

    // Clean up cache - keep only adjacent images
    const keepPaths = new Set([nextPath, prevPath].filter(Boolean));
    for (const [path, data] of this.preloadCache.entries()) {
      if (!keepPaths.has(path)) {
        if (data.img) {
          data.img.src = ""; // Release memory
        }
        this.preloadCache.delete(path);
      }
    }
  }

  preloadImageWithZoom(imagePath) {
    try {
      const img = new Image();
      const encodedPath = `file://${encodeURI(imagePath.replace(/\\/g, "/"))
        .replace(/#/g, "%23")
        .replace(/\?/g, "%3F")}`;

      img.onload = () => {
        // Calculate zoom and position for this image
        const newWidth = img.naturalWidth;
        const newHeight = img.naturalHeight;
        let zoom, translateX, translateY;

        if (this.auto === true) {
          // Zoom to fit mode
          zoom = Math.min(
            this.refs.imageContainer.offsetWidth / newWidth,
            this.refs.imageContainer.offsetHeight / newHeight
          );
          const imageWidth = newWidth * zoom;
          const imageHeight = newHeight * zoom;
          translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
          translateY =
            (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
        } else if (this.auto === 1) {
          // Zoom to 100 mode
          zoom = Math.min(
            1.0,
            Math.min(
              this.refs.imageContainer.offsetWidth / newWidth,
              this.refs.imageContainer.offsetHeight / newHeight
            )
          );
          const imageWidth = newWidth * zoom;
          const imageHeight = newHeight * zoom;
          translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
          translateY =
            (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
        } else {
          // Manual zoom - keep current zoom and center the image
          zoom = this.zoom;
          const imageWidth = newWidth * zoom;
          const imageHeight = newHeight * zoom;
          translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
          translateY =
            (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
        }

        // Store preloaded image with calculated metadata
        this.preloadCache.set(imagePath, {
          img: img,
          encodedPath: encodedPath,
          width: newWidth,
          height: newHeight,
          zoom: zoom,
          translateX: translateX,
          translateY: translateY,
        });

        // Optionally decode in background
        if (img.decode) {
          img.decode().catch(() => {
            // Ignore decode errors for preloaded images
          });
        }
      };

      img.onerror = () => {
        this.preloadCache.delete(imagePath);
      };

      img.src = encodedPath;
    } catch (e) {
      // Silently fail preloading
    }
  }

  // Fast file list using tree-view or filesystem
  getFileList() {
    const currentPath = this.editor.getPath();
    const directory = path.dirname(currentPath);

    // Check if cache is valid for the directory
    // We still need to update currentIndex even if cache is valid
    if (
      this.fileListCache.directory === directory &&
      this.fileListCache.files.length > 0
    ) {
      // Update current index based on actual current file
      this.fileListCache.currentIndex = this.fileListCache.files.findIndex(
        (f) =>
          path.normalize(f).toLowerCase() ===
          path.normalize(currentPath).toLowerCase()
      );
      return this.fileListCache;
    }

    // Try to get files from tree-view first (much faster!)
    const treeView = this.editor.treeView;
    let files = [];

    if (treeView && treeView.entryForPath) {
      try {
        const dirEntry = treeView.entryForPath(directory);
        if (dirEntry && dirEntry.children) {
          // Get files from tree-view's already-loaded directory
          files = Array.from(dirEntry.children)
            .filter((entry) => {
              if (!entry.file || !entry.path) return false;
              const ext = path.extname(entry.path).toLowerCase();
              return this.fileListCache.extensions.includes(ext);
            })
            .map((entry) => entry.path)
            .sort((a, b) =>
              path.basename(a).localeCompare(path.basename(b), undefined, {
                numeric: true,
                sensitivity: "base",
              })
            );
        }
      } catch (e) {}
    }

    // Fallback to filesystem if tree-view didn't work
    if (files.length === 0) {
      try {
        files = fs
          .readdirSync(directory)
          .filter((file) =>
            this.fileListCache.extensions.includes(
              path.extname(file).toLowerCase()
            )
          )
          .map((file) => path.join(directory, file))
          .sort((a, b) =>
            path.basename(a).localeCompare(path.basename(b), undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
      } catch (e) {
        console.error("Error reading directory:", e);
        return {
          directory: null,
          files: [],
          currentIndex: -1,
          extensions: this.fileListCache.extensions,
        };
      }
    }

    // Update cache
    this.fileListCache.directory = directory;
    this.fileListCache.files = files;

    // Find current file index
    this.fileListCache.currentIndex = files.findIndex(
      (f) =>
        path.normalize(f).toLowerCase() ===
        path.normalize(currentPath).toLowerCase()
    );

    return this.fileListCache;
  }

  // Invalidate cache when directory might have changed
  invalidateFileListCache() {
    this.fileListCache.directory = null;
    this.fileListCache.files = [];
    this.fileListCache.currentIndex = -1;
  }

  updateSize(zoom) {
    if (!this.loaded || this.element.offsetHeight === 0) {
      return;
    }
    this.disableAutoZoom();

    this.zoom = Math.min(Math.max(zoom, 0.001), 100);
    // this.step is no longer needed for scroll-based zoom, but keeping if referenced elsewhere (it was used in scroll handlers)

    this.updateTransform();
  }

  updateTransform() {
    // Use requestAnimationFrame for smoother updates
    if (!this.transformRAF) {
      this.transformRAF = requestAnimationFrame(() => {
        this.transformRAF = null;
        this._applyTransform();
      });
    }
  }

  _applyTransform() {
    // Use GPU-accelerated transforms with will-change hint
    this.refs.image.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoom})`;
    this.refs.image.style.willChange = "transform"; // GPU acceleration hint

    // Clear explicit width/height to let transform handle it
    this.refs.image.style.width = "";
    this.refs.image.style.height = "";

    const percent = Math.round(this.zoom * 1000) / 10;
    this.refs.resetZoomButton.textContent = percent + "%";

    // Update selection box position if visible
    if (
      this.refs.selectionBox &&
      this.refs.selectionBox.style.display === "block"
    ) {
      this.updateSelectionBox();
    }
  }

  updateSelectionBox() {
    if (!this.refs.selectionBox) return;

    // Convert from image space to viewport space
    const leftImg = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
    const topImg = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
    const widthImg = Math.abs(
      this.selectionEndImg.x - this.selectionStartImg.x
    );
    const heightImg = Math.abs(
      this.selectionEndImg.y - this.selectionStartImg.y
    );

    // Transform to viewport coordinates
    const left = leftImg * this.zoom + this.translateX;
    const top = topImg * this.zoom + this.translateY;
    const width = widthImg * this.zoom;
    const height = heightImg * this.zoom;

    this.refs.selectionBox.style.left = left + "px";
    this.refs.selectionBox.style.top = top + "px";
    this.refs.selectionBox.style.width = width + "px";
    this.refs.selectionBox.style.height = height + "px";
  }

  centerImage() {
    if (!this.loaded || this.element.offsetHeight === 0) return;

    const containerWidth = this.refs.imageContainer.offsetWidth;
    const containerHeight = this.refs.imageContainer.offsetHeight;

    // Always use the current container center as the origin
    // This ensures centering works correctly even when pane is resized
    // or when there are multiple panes in the workspace
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Set origin on first center (when origin is 0,0)
    // Origin is the center of the viewport - this becomes our fixed reference point
    if (this.originX === 0 && this.originY === 0) {
      this.originX = centerX;
      this.originY = centerY;
    }

    // Position image so its center aligns with the current pane center
    const imageWidth = this.refs.image.naturalWidth * this.zoom;
    const imageHeight = this.refs.image.naturalHeight * this.zoom;

    this.translateX = centerX - imageWidth / 2;
    this.translateY = centerY - imageHeight / 2;

    this.updateTransform();
  }

  zoomToMousePosition(newZoom, event) {
    if (!this.loaded) return;

    const { left, top } = this.refs.imageContainer.getBoundingClientRect();
    const mouseX = event.clientX - left;
    const mouseY = event.clientY - top;

    // Point in image coordinates (unscaled)
    const imageX = (mouseX - this.translateX) / this.zoom;
    const imageY = (mouseY - this.translateY) / this.zoom;

    this.updateSize(newZoom);

    // We want (imageX * newZoom + newTranslateX) = mouseX
    this.translateX = mouseX - imageX * this.zoom;
    this.translateY = mouseY - imageY * this.zoom;

    this.updateTransform();
  }

  zoomToCenterPoint(newZoom) {
    if (!this.loaded) return;

    const containerWidth = this.refs.imageContainer.offsetWidth;
    const containerHeight = this.refs.imageContainer.offsetHeight;

    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    const imageX = (centerX - this.translateX) / this.zoom;
    const imageY = (centerY - this.translateY) / this.zoom;

    this.updateSize(newZoom);

    this.translateX = centerX - imageX * this.zoom;
    this.translateY = centerY - imageY * this.zoom;

    this.updateTransform();
  }

  _zoomToFit(limit, auto, element) {
    if (!this.loaded || this.element.offsetHeight === 0) {
      return;
    }
    let zoom = Math.min(
      this.refs.imageContainer.offsetWidth / this.refs.image.naturalWidth,
      this.refs.imageContainer.offsetHeight / this.refs.image.naturalHeight
    );
    if (limit) {
      zoom = Math.min(zoom, limit);
    }
    this.updateSize(zoom);
    this.centerImage();
    this.auto = auto;
    element.classList.add("selected");
  }

  zoomToFit() {
    this._zoomToFit(false, true, this.refs.zoomToFitButton);
  }

  zoomTo100() {
    this._zoomToFit(1, 1, this.refs.zoomTo100Button);
  }

  zoomOut() {
    for (let i = this.levels.length - 1; i >= 0; i--) {
      if (this.levels[i] < this.zoom) {
        this.zoomToCenterPoint(this.levels[i]);
        break;
      }
    }
  }

  zoomIn() {
    for (let i = 0; i < this.levels.length; i++) {
      if (this.levels[i] > this.zoom) {
        this.zoomToCenterPoint(this.levels[i]);
        break;
      }
    }
  }

  resetZoom() {
    if (!this.loaded || this.element.offsetHeight === 0) {
      return;
    }
    this.zoomToCenterPoint(1);
  }

  hideSelection() {
    if (this.refs.selectionBox) {
      this.refs.selectionBox.style.display = "none";
    }
    this.selecting = false;
    this.moving = false;
    this.resizing = false;
    this.resizeHandle = null;
  }

  disableAutoZoom() {
    this.auto = false;
    if (this.refs.zoomToFitButton) {
      this.refs.zoomToFitButton.classList.remove("selected");
    }
    if (this.refs.zoomTo100Button) {
      this.refs.zoomTo100Button.classList.remove("selected");
    }
  }

  changeBackground(color) {
    if (this.loaded && this.element.offsetHeight > 0 && color) {
      this.refs.imageContainer.setAttribute("background", color);
    }
  }

  scrollUp() {
    this.disableAutoZoom();
    this.translateY += this.refs.imageContainer.offsetHeight / 10;
    this.updateTransform();
  }

  scrollDown() {
    this.disableAutoZoom();
    this.translateY -= this.refs.imageContainer.offsetHeight / 10;
    this.updateTransform();
  }

  scrollLeft() {
    this.disableAutoZoom();
    this.translateX += this.refs.imageContainer.offsetWidth / 10;
    this.updateTransform();
  }

  scrollRight() {
    this.disableAutoZoom();
    this.translateX -= this.refs.imageContainer.offsetWidth / 10;
    this.updateTransform();
  }

  pageUp() {
    this.disableAutoZoom();
    this.translateY += this.refs.imageContainer.offsetHeight;
    this.updateTransform();
  }

  pageDown() {
    this.disableAutoZoom();
    this.translateY -= this.refs.imageContainer.offsetHeight;
    this.updateTransform();
  }

  scrollToTop() {
    this.disableAutoZoom();
    this.translateY = 0;
    this.updateTransform();
  }

  scrollToBottom() {
    this.disableAutoZoom();
    this.translateY =
      this.refs.imageContainer.offsetHeight -
      this.refs.image.naturalHeight * this.zoom;
    this.updateTransform();
  }

  getAdjacentImage(direction) {
    const fileList = this.getFileList();

    if (fileList.files.length === 0 || fileList.currentIndex === -1) {
      return null;
    }

    let newIndex = fileList.currentIndex + direction;

    // Wrap around
    if (newIndex < 0) {
      newIndex = fileList.files.length - 1;
    } else if (newIndex >= fileList.files.length) {
      newIndex = 0;
    }

    return fileList.files[newIndex];
  }

  // Load image without flicker by preloading and calculating position before display
  loadImageWithoutFlicker(imagePath) {
    if (!imagePath) return;

    // Check if we have this image preloaded with metadata
    const preloadedData = this.preloadCache.get(imagePath);

    if (
      preloadedData &&
      preloadedData.img &&
      preloadedData.img.complete &&
      preloadedData.img.naturalWidth > 0
    ) {
      // Image is already loaded with zoom calculated, use it directly
      this.applyPreloadedImageWithMetadata(imagePath, preloadedData);
    } else {
      // Need to load it first
      const encodedPath = `file://${encodeURI(imagePath.replace(/\\/g, "/"))
        .replace(/#/g, "%23")
        .replace(/\?/g, "%3F")}?time=${Date.now()}`;

      const tempImg = new Image();
      tempImg.onload = () => {
        // Calculate zoom on the fly
        const preloadedData = this.calculateZoomForImage(tempImg, encodedPath);
        this.applyPreloadedImageWithMetadata(imagePath, preloadedData);
      };
      tempImg.onerror = () => {
        atom.notifications.addError("Failed to load image", {
          description: `Could not load ${imagePath}`,
        });
      };
      tempImg.src = encodedPath;
    }
  }

  calculateZoomForImage(img, encodedPath) {
    const newWidth = img.naturalWidth;
    const newHeight = img.naturalHeight;
    let zoom, translateX, translateY;

    if (this.auto === true) {
      // Zoom to fit mode
      zoom = Math.min(
        this.refs.imageContainer.offsetWidth / newWidth,
        this.refs.imageContainer.offsetHeight / newHeight
      );
      const imageWidth = newWidth * zoom;
      const imageHeight = newHeight * zoom;
      translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
      translateY = (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
    } else if (this.auto === 1) {
      // Zoom to 100 mode
      zoom = Math.min(
        1.0,
        Math.min(
          this.refs.imageContainer.offsetWidth / newWidth,
          this.refs.imageContainer.offsetHeight / newHeight
        )
      );
      const imageWidth = newWidth * zoom;
      const imageHeight = newHeight * zoom;
      translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
      translateY = (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
    } else {
      // Manual zoom - keep current zoom and center the image
      zoom = this.zoom;
      const imageWidth = newWidth * zoom;
      const imageHeight = newHeight * zoom;
      translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
      translateY = (this.refs.imageContainer.offsetHeight - imageHeight) / 2;
    }

    return {
      img: img,
      encodedPath: encodedPath,
      width: newWidth,
      height: newHeight,
      zoom: zoom,
      translateX: translateX,
      translateY: translateY,
    };
  }

  applyPreloadedImageWithMetadata(imagePath, preloadedData) {
    // All calculations are done, just apply them synchronously
    this.refs.image.src = preloadedData.encodedPath;
    this.originalWidth = preloadedData.width;
    this.originalHeight = preloadedData.height;
    this.zoom = preloadedData.zoom;
    this.translateX = preloadedData.translateX;
    this.translateY = preloadedData.translateY;

    // Apply transform immediately
    this._applyTransform();

    // Update file path in editor
    this.editor.load(imagePath);

    // Reset history - defer saveToHistory() until first edit operation
    this.history = [];
    this.historyIndex = -1;
    this.needsInitialHistorySave = true; // Flag: save initial state before first edit
    this.emitModifiedStateIfChanged();

    this.refs.selectionBox.style.display = "none";
    this.emitter.emit("did-update");
    this.emitter.emit("did-load");

    // Preload adjacent images for next navigation
    setTimeout(() => this.preloadAdjacentImages(), 100);
  }

  // Ensure initial history state is saved before any edit operation
  ensureInitialHistorySaved() {
    if (this.needsInitialHistorySave) {
      this.needsInitialHistorySave = false;
      this.saveToHistory();
    }
  }

  nextImage() {
    const now = Date.now();
    if (this.lastNavigationTime && now - this.lastNavigationTime < 50) {
      return;
    }
    this.lastNavigationTime = now;

    const fileList = this.getFileList();
    const isAtEnd =
      fileList.files.length > 0 &&
      fileList.currentIndex === fileList.files.length - 1;

    if (isAtEnd) {
      this.showBoundaryOverlay("right");
    }

    const nextPath = this.getAdjacentImage(1);
    if (
      nextPath &&
      path.normalize(nextPath) !== path.normalize(this.editor.getPath())
    ) {
      this.loadImageWithoutFlicker(nextPath);
    }
  }

  previousImage() {
    const now = Date.now();
    if (this.lastNavigationTime && now - this.lastNavigationTime < 50) {
      return;
    }
    this.lastNavigationTime = now;

    const fileList = this.getFileList();
    const isAtStart = fileList.files.length > 0 && fileList.currentIndex === 0;

    if (isAtStart) {
      this.showBoundaryOverlay("left");
    }

    const prevPath = this.getAdjacentImage(-1);
    if (
      prevPath &&
      path.normalize(prevPath) !== path.normalize(this.editor.getPath())
    ) {
      this.loadImageWithoutFlicker(prevPath);
    }
  }

  showBoundaryOverlay(direction) {
    if (!this.refs.boundaryOverlay) return;

    const overlay = this.refs.boundaryOverlay;
    overlay.className = `boundary-overlay boundary-overlay-${direction}`;

    // Force reflow to restart animation
    overlay.offsetHeight;

    overlay.classList.add("active");

    // Remove the active class after animation completes
    if (this.boundaryOverlayTimeout) {
      clearTimeout(this.boundaryOverlayTimeout);
    }
    this.boundaryOverlayTimeout = setTimeout(() => {
      overlay.classList.remove("active");
    }, 800);
  }

  firstImage() {
    const fileList = this.getFileList();

    if (fileList.files.length > 0) {
      const firstPath = fileList.files[0];
      if (path.normalize(firstPath) !== path.normalize(this.editor.getPath())) {
        this.loadImageWithoutFlicker(firstPath);
      }
    }
  }

  lastImage() {
    const fileList = this.getFileList();

    if (fileList.files.length > 0) {
      const lastPath = fileList.files[fileList.files.length - 1];
      if (path.normalize(lastPath) !== path.normalize(this.editor.getPath())) {
        this.loadImageWithoutFlicker(lastPath);
      }
    }
  }

  cropToSelection() {
    // Check if selection exists and is visible
    if (
      !this.refs.selectionBox ||
      this.refs.selectionBox.style.display === "none"
    ) {
      atom.notifications.addWarning("No selection", {
        description:
          "Please create a selection first by dragging with the left mouse button.",
      });
      return;
    }

    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Update current history state before cropping to ensure we can restore to the exact view
    this.updateCurrentHistoryState();

    // Get selection coordinates in image space (already stored)
    const imgLeft = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
    const imgTop = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
    const imgWidth = Math.abs(
      this.selectionEndImg.x - this.selectionStartImg.x
    );
    const imgHeight = Math.abs(
      this.selectionEndImg.y - this.selectionStartImg.y
    );

    if (imgWidth === 0 || imgHeight === 0) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Ensure initial state is saved (only happens once)
    this.ensureInitialHistorySaved();

    // Create canvas for cropping using pool
    const canvas = this.getPooledCanvas(imgWidth, imgHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Draw the cropped portion
    ctx.drawImage(
      this.refs.image,
      imgLeft,
      imgTop,
      imgWidth,
      imgHeight, // Source rectangle
      0,
      0,
      imgWidth,
      imgHeight // Destination rectangle
    );

    // Convert canvas to blob and update image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);

      // Calculate where the cropped area's center is in viewport coordinates
      const cropCenterX =
        this.translateX + (imgLeft + imgWidth / 2) * this.zoom;
      const cropCenterY =
        this.translateY + (imgTop + imgHeight / 2) * this.zoom;

      // Load image in background first to avoid flicker
      const tempImg = new Image();
      tempImg.onload = () => {
        this.refs.image.src = url;

        // Synchronously update everything now that the image is ready
        this.originalHeight = tempImg.naturalHeight;
        this.originalWidth = tempImg.naturalWidth;

        // Position the cropped image so its center is at the same location
        if (this.auto === true) {
          this.zoomToFit();
        } else if (this.auto === 1) {
          this.zoomTo100();
        } else {
          // Keep current zoom
          // Position the new image so its center aligns with where the crop center was
          const newImageWidth = this.originalWidth * this.zoom;
          const newImageHeight = this.originalHeight * this.zoom;

          this.translateX = cropCenterX - newImageWidth / 2;
          this.translateY = cropCenterY - newImageHeight / 2;

          this.updateTransform();
        }

        this.setSelectionVisibility(false);

        // Emit update event to refresh status bar
        this.emitter.emit("did-update");

        // Save the result to history so redo works
        this.saveToHistory();

        if (atom.config.get("image-editor.showSuccessMessages.crop")) {
          atom.notifications.addSuccess("Image cropped", {
            description:
              'Image has been cropped to selection. Use "Save" to save changes.',
          });
        }
      };
      tempImg.src = url;
    }, "image/png");
  }

  blurImage(blurLevel) {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save to history BEFORE making changes
    this.ensureInitialHistorySaved();

    const clampedLeft = area.left;
    const clampedTop = area.top;
    const clampedWidth = area.width;
    const clampedHeight = area.height;

    // For large areas, show progress notification
    const isLargeArea = clampedWidth * clampedHeight > 2000000; // > 2 megapixels
    if (isLargeArea) {
      atom.notifications.addInfo("Processing blur...", {
        description: "This may take a moment for large images.",
        dismissable: true,
      });
    }

    // Use setTimeout to prevent blocking UI
    setTimeout(() => {
      // Create canvas from entire current image
      const canvas = document.createElement("canvas");
      canvas.width = this.refs.image.naturalWidth;
      canvas.height = this.refs.image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      // Draw the entire image first
      ctx.drawImage(this.refs.image, 0, 0);

      // Extract the region to blur
      const selectedRegion = ctx.getImageData(
        clampedLeft,
        clampedTop,
        clampedWidth,
        clampedHeight
      );

      // Calculate blur radius based on level
      const radius = blurLevel * 2; // Scale blur level

      // Apply Fast Gaussian Blur using box blur approximation
      this.fastGaussianBlur(
        selectedRegion,
        clampedWidth,
        clampedHeight,
        radius
      );

      // Put the blurred data back to main canvas
      ctx.putImageData(selectedRegion, clampedLeft, clampedTop);

      const areaText = area.hasSelection ? "selection" : "image";
      this.updateImageFromCanvasWithoutHistory(
        canvas,
        `Blur level ${blurLevel} applied to ${areaText}`,
        "blur"
      );
    }, 10);
  }

  // Fast Gaussian Blur implementation using box blur approximation
  fastGaussianBlur(imageData, width, height, radius) {
    const pixels = imageData.data;
    const boxes = this.boxesForGauss(radius, 3); // 3 passes for good approximation

    // Apply horizontal and vertical box blurs
    for (let i = 0; i < 3; i++) {
      this.boxBlur(pixels, width, height, (boxes[i] - 1) / 2);
    }
  }

  // Calculate box sizes for Gaussian approximation
  boxesForGauss(sigma, n) {
    const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
    let wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    const wu = wl + 2;

    const mIdeal =
      (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
    const m = Math.round(mIdeal);

    const sizes = [];
    for (let i = 0; i < n; i++) {
      sizes.push(i < m ? wl : wu);
    }
    return sizes;
  }

  // Box blur implementation (horizontal + vertical)
  boxBlur(pixels, width, height, radius) {
    const temp = new Uint8ClampedArray(pixels.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0;

        for (let kx = -radius; kx <= radius; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const offset = (y * width + px) * 4;
          r += pixels[offset];
          g += pixels[offset + 1];
          b += pixels[offset + 2];
          a += pixels[offset + 3];
          count++;
        }

        const offset = (y * width + x) * 4;
        temp[offset] = r / count;
        temp[offset + 1] = g / count;
        temp[offset + 2] = b / count;
        temp[offset + 3] = a / count;
      }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const offset = (py * width + x) * 4;
          r += temp[offset];
          g += temp[offset + 1];
          b += temp[offset + 2];
          a += temp[offset + 3];
          count++;
        }

        const offset = (y * width + x) * 4;
        pixels[offset] = r / count;
        pixels[offset + 1] = g / count;
        pixels[offset + 2] = b / count;
        pixels[offset + 3] = a / count;
      }
    }
  }

  async save() {
    if (!this.loaded) {
      atom.notifications.addError("No image to save");
      return;
    }

    const currentPath = this.editor.getPath();
    if (!currentPath) {
      // If no path exists, fall back to saveImage (Save As)
      return this.saveImage();
    }

    try {
      this.isSaving = true;
      const ext = path.extname(currentPath).toLowerCase();
      const mimeType =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

      // Create canvas from current image
      const canvas = document.createElement("canvas");
      canvas.width = this.refs.image.naturalWidth;
      canvas.height = this.refs.image.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.refs.image, 0, 0);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        try {
          const buffer = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(currentPath, buffer);
          // Reset history after successful save - current state becomes the new clean state
          this.history = [];
          this.historyIndex = -1;
          this.needsInitialHistorySave = true;
          this.emitModifiedStateIfChanged();
          if (atom.config.get("image-editor.showSuccessMessages.save")) {
            atom.notifications.addSuccess("Image saved", {
              description: `Saved to ${currentPath}`,
            });
          }
        } finally {
          // Clear flag after a short delay to ensure file watcher event is ignored
          setTimeout(() => {
            this.isSaving = false;
          }, 100);
        }
      }, mimeType);
    } catch (error) {
      this.isSaving = false;
      atom.notifications.addError("Failed to save image", {
        description: error.message,
      });
    }
  }

  async saveImage() {
    if (!this.loaded) {
      atom.notifications.addError("No image to save");
      return;
    }

    const { remote } = require("electron");
    const currentPath = this.editor.getPath();
    const defaultPath = currentPath || "untitled.png";

    try {
      const result = await remote.dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
          { name: "PNG Images", extensions: ["png"] },
          { name: "JPEG Images", extensions: ["jpg", "jpeg"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return;
      }

      const savePath = result.filePath;
      const ext = path.extname(savePath).toLowerCase();
      const mimeType =
        ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

      // Create canvas from current image
      const canvas = document.createElement("canvas");
      canvas.width = this.refs.image.naturalWidth;
      canvas.height = this.refs.image.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.refs.image, 0, 0);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        const buffer = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync(savePath, buffer);
        if (atom.config.get("image-editor.showSuccessMessages.save")) {
          atom.notifications.addSuccess("Image saved", {
            description: `Saved to ${savePath}`,
          });
        }
      }, mimeType);
    } catch (error) {
      atom.notifications.addError("Failed to save image", {
        description: error.message,
      });
    }
  }

  rotate(degrees) {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Save to history BEFORE making changes
    this.ensureInitialHistorySaved();

    // Create canvas for rotation
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // For 90 or 270 degree rotations, swap width and height
    const isOrthogonal = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;
    if (isOrthogonal) {
      canvas.width = this.refs.image.naturalHeight;
      canvas.height = this.refs.image.naturalWidth;
    } else {
      canvas.width = this.refs.image.naturalWidth;
      canvas.height = this.refs.image.naturalHeight;
    }

    // Save current state
    ctx.save();

    // Move to center, rotate, then move back
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((degrees * Math.PI) / 180);
    ctx.translate(
      -this.refs.image.naturalWidth / 2,
      -this.refs.image.naturalHeight / 2
    );

    // Draw the image
    ctx.drawImage(this.refs.image, 0, 0);
    ctx.restore();

    // Convert canvas to blob and update image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.originalHeight = this.refs.image.naturalHeight;
        this.originalWidth = this.refs.image.naturalWidth;

        // Re-apply auto-zoom if active
        if (this.auto === true) {
          this.zoomToFit();
        } else if (this.auto === 1) {
          this.zoomTo100();
        } else {
          this.updateTransform();
        }
        this.refs.selectionBox.style.display = "none";

        // Emit update event to refresh status bar
        this.emitter.emit("did-update");

        // Save the result to history so redo works
        this.saveToHistory();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          const direction = degrees > 0 ? "clockwise" : "counter-clockwise";
          atom.notifications.addSuccess("Image rotated", {
            description: `Rotated ${Math.abs(degrees)}° ${
              degrees === 180 ? "" : direction
            }. Use "Save" to save changes.`,
          });
        }
      };
    }, "image/png");
  }

  flipHorizontal() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Save to history BEFORE making changes
    this.ensureInitialHistorySaved();

    // Create canvas for flipping
    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Flip horizontally
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(this.refs.image, -canvas.width, 0);
    ctx.restore();

    // Convert canvas to blob and update image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.refs.selectionBox.style.display = "none";

        // Emit update event to refresh status bar
        this.emitter.emit("did-update");

        // Save the result to history so redo works
        this.saveToHistory();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image flipped", {
            description: 'Flipped horizontally. Use "Save" to save changes.',
          });
        }
      };
    }, "image/png");
  }

  flipVertical() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Save to history BEFORE making changes
    this.ensureInitialHistorySaved();

    // Create canvas for flipping
    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    // Flip vertically
    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(this.refs.image, 0, -canvas.height);
    ctx.restore();

    // Convert canvas to blob and update image
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.refs.selectionBox.style.display = "none";

        // Emit update event to refresh status bar
        this.emitter.emit("did-update");

        // Save the result to history so redo works
        this.saveToHistory();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image flipped", {
            description: 'Flipped vertically. Use "Save" to save changes.',
          });
        }
      };
    }, "image/png");
  }

  // Helper method to get selection area or entire image
  getSelectionArea() {
    const hasSelection =
      this.refs.selectionBox && this.refs.selectionBox.style.display !== "none";

    if (hasSelection) {
      // Selection coordinates are already in image space
      const imgLeft = Math.round(
        Math.min(this.selectionStartImg.x, this.selectionEndImg.x)
      );
      const imgTop = Math.round(
        Math.min(this.selectionStartImg.y, this.selectionEndImg.y)
      );
      const imgWidth = Math.round(
        Math.abs(this.selectionEndImg.x - this.selectionStartImg.x)
      );
      const imgHeight = Math.round(
        Math.abs(this.selectionEndImg.y - this.selectionStartImg.y)
      );

      if (imgWidth === 0 || imgHeight === 0) {
        return null; // Invalid selection
      }

      return {
        hasSelection: true,
        left: Math.max(0, Math.min(imgLeft, this.refs.image.naturalWidth)),
        top: Math.max(0, Math.min(imgTop, this.refs.image.naturalHeight)),
        width: Math.min(
          imgWidth,
          this.refs.image.naturalWidth - Math.max(0, imgLeft)
        ),
        height: Math.min(
          imgHeight,
          this.refs.image.naturalHeight - Math.max(0, imgTop)
        ),
      };
    } else {
      return {
        hasSelection: false,
        left: 0,
        top: 0,
        width: this.refs.image.naturalWidth,
        height: this.refs.image.naturalHeight,
      };
    }
  }

  applyGrayscale() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save to history BEFORE making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    // Draw the entire image
    ctx.drawImage(this.refs.image, 0, 0);

    // Get the area to process
    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Grayscale applied to ${areaText}`,
      "adjustment"
    );
  }

  invertColors() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save to history
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // Red
      data[i + 1] = 255 - data[i + 1]; // Green
      data[i + 2] = 255 - data[i + 2]; // Blue
      // Alpha channel (i + 3) remains unchanged
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Colors inverted on ${areaText}`,
      "adjustment"
    );
  }

  applySepia() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save to history
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Sepia tone applied to ${areaText}`,
      "adjustment"
    );
  }

  sharpenImage(strength) {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save to history
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const pixels = imageData.data;
    const width = area.width;
    const height = area.height;

    // Sharpen kernel (adjustable by strength)
    const kernel = [
      0,
      -strength,
      0,
      -strength,
      1 + 4 * strength,
      -strength,
      0,
      -strength,
      0,
    ];

    const result = new Uint8ClampedArray(pixels.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          // RGB channels only
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              const kernelIdx = (ky + 1) * 3 + (kx + 1);
              sum += pixels[idx] * kernel[kernelIdx];
            }
          }
          const idx = (y * width + x) * 4 + c;
          result[idx] = Math.min(255, Math.max(0, sum));
        }
        // Copy alpha channel
        const idx = (y * width + x) * 4;
        result[idx + 3] = pixels[idx + 3];
      }
    }

    // Copy edges from original
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 4; c++) {
            result[idx + c] = pixels[idx + c];
          }
        }
      }
    }

    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = result[i];
    }

    ctx.putImageData(imageData, area.left, area.top);

    const strengthName =
      strength === 0.5 ? "light" : strength === 1.0 ? "medium" : "strong";
    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Sharpen (${strengthName}) applied to ${areaText}`,
      "adjustment"
    );
  }

  copySelectionToClipboard() {
    if (
      !this.refs.selectionBox ||
      this.refs.selectionBox.style.display === "none"
    ) {
      atom.notifications.addWarning("No selection", {
        description:
          "Please create a selection first by dragging with the left mouse button.",
      });
      return;
    }

    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Get selection coordinates in image space
    const imgLeft = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
    const imgTop = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
    const imgWidth = Math.abs(
      this.selectionEndImg.x - this.selectionStartImg.x
    );
    const imgHeight = Math.abs(
      this.selectionEndImg.y - this.selectionStartImg.y
    );

    if (imgWidth === 0 || imgHeight === 0) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      this.refs.image,
      imgLeft,
      imgTop,
      imgWidth,
      imgHeight,
      0,
      0,
      imgWidth,
      imgHeight
    );

    canvas.toBlob((blob) => {
      const { clipboard, nativeImage } = require("electron");
      blob.arrayBuffer().then((buffer) => {
        const image = nativeImage.createFromBuffer(Buffer.from(buffer));
        clipboard.writeImage(image);
        if (atom.config.get("image-editor.showSuccessMessages.clipboard")) {
          atom.notifications.addSuccess("Selection copied", {
            description: "Selection copied to clipboard.",
          });
        }
      });
    }, "image/png");
  }

  autoSelect(borderPercent = 0) {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Create canvas to analyze pixels
    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Get tolerance from config
    const tolerance = atom.config.get("image-editor.autoSelectTolerance") || 30;

    // Sample corner pixels to determine background color
    // Use average of corners as reference background
    const getPixel = (x, y) => {
      const idx = (y * width + x) * 4;
      return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3],
      };
    };

    const corners = [
      getPixel(0, 0),
      getPixel(width - 1, 0),
      getPixel(0, height - 1),
      getPixel(width - 1, height - 1),
    ];

    const bgColor = {
      r: Math.round(
        (corners[0].r + corners[1].r + corners[2].r + corners[3].r) / 4
      ),
      g: Math.round(
        (corners[0].g + corners[1].g + corners[2].g + corners[3].g) / 4
      ),
      b: Math.round(
        (corners[0].b + corners[1].b + corners[2].b + corners[3].b) / 4
      ),
      a: Math.round(
        (corners[0].a + corners[1].a + corners[2].a + corners[3].a) / 4
      ),
    };

    // Function to check if pixel is similar to background
    const isBackground = (pixel) => {
      const dr = Math.abs(pixel.r - bgColor.r);
      const dg = Math.abs(pixel.g - bgColor.g);
      const db = Math.abs(pixel.b - bgColor.b);
      const da = Math.abs(pixel.a - bgColor.a);
      return (dr + dg + db + da) / 4 <= tolerance;
    };

    // Scan from edges to find content boundaries
    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    // Scan from top
    found: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBackground(getPixel(x, y))) {
          top = y;
          break found;
        }
      }
    }

    // Scan from bottom
    found: for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        if (!isBackground(getPixel(x, y))) {
          bottom = y;
          break found;
        }
      }
    }

    // Scan from left
    found: for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (!isBackground(getPixel(x, y))) {
          left = x;
          break found;
        }
      }
    }

    // Scan from right
    found: for (let x = width - 1; x >= 0; x--) {
      for (let y = 0; y < height; y++) {
        if (!isBackground(getPixel(x, y))) {
          right = x;
          break found;
        }
      }
    }

    // Check if we found any content
    if (left >= right || top >= bottom) {
      atom.notifications.addWarning("No content detected", {
        description:
          "Could not detect content boundaries. Try adjusting the tolerance in settings.",
      });
      return;
    }

    // Check if entire image is content
    if (
      left === 0 &&
      right === width - 1 &&
      top === 0 &&
      bottom === height - 1
    ) {
      atom.notifications.addInfo("Entire image is content", {
        description:
          "No background detected. The entire image appears to be content.",
      });
      return;
    }

    // Add border if requested
    if (borderPercent > 0) {
      // Calculate border based on larger content dimension (not image dimension)
      const contentWidth = right - left + 1;
      const contentHeight = bottom - top + 1;
      const largerContentDimension = Math.max(contentWidth, contentHeight);
      const border = Math.round(
        (largerContentDimension * borderPercent) / 100
      );

      // Expand selection by border on all sides equally
      left = Math.max(0, left - border);
      right = Math.min(width - 1, right + border);
      top = Math.max(0, top - border);
      bottom = Math.min(height - 1, bottom + border);
    }

    // Create selection from detected boundaries
    this.selectionStartImg = { x: left, y: top };
    this.selectionEndImg = { x: right, y: bottom };
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    const borderText =
      borderPercent > 0 ? ` with ${borderPercent}% border` : "";
    atom.notifications.addSuccess(`Auto-selection complete${borderText}`, {
      description: `Selected ${right - left}x${bottom - top} px area.`,
    });
  }

  // Helper method to show/hide selection and emit event
  setSelectionVisibility(visible) {
    this.refs.selectionBox.style.display = visible ? "block" : "none";
    this.emitter.emit("selection-visibility-changed", visible);
  }

  selectAll() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    // Select the entire image
    this.selectionStartImg = { x: 0, y: 0 };
    this.selectionEndImg = {
      x: this.refs.image.naturalWidth - 1,
      y: this.refs.image.naturalHeight - 1,
    };
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    if (atom.config.get("image-editor.showSuccessMessages.selection")) {
      atom.notifications.addSuccess("Selected entire image", {
        description: `Selected ${this.refs.image.naturalWidth}×${this.refs.image.naturalHeight} px.`,
      });
    }
  }

  selectVisibleArea() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const containerWidth = this.refs.imageContainer.offsetWidth;
    const containerHeight = this.refs.imageContainer.offsetHeight;

    // Calculate which part of the image (in image space) is visible in viewport
    // Viewport coordinates (0, 0) maps to image coordinates:
    const viewportLeft = 0;
    const viewportTop = 0;
    const viewportRight = containerWidth;
    const viewportBottom = containerHeight;

    // Convert viewport bounds to image space
    let imgLeft = (viewportLeft - this.translateX) / this.zoom;
    let imgTop = (viewportTop - this.translateY) / this.zoom;
    let imgRight = (viewportRight - this.translateX) / this.zoom;
    let imgBottom = (viewportBottom - this.translateY) / this.zoom;

    // Clamp to image boundaries
    imgLeft = Math.max(0, Math.min(imgLeft, this.refs.image.naturalWidth));
    imgTop = Math.max(0, Math.min(imgTop, this.refs.image.naturalHeight));
    imgRight = Math.max(0, Math.min(imgRight, this.refs.image.naturalWidth));
    imgBottom = Math.max(0, Math.min(imgBottom, this.refs.image.naturalHeight));

    // Check if there's any visible area
    if (imgLeft >= imgRight || imgTop >= imgBottom) {
      atom.notifications.addWarning("No visible area", {
        description: "Image is not visible in the current viewport.",
      });
      return;
    }

    // Create selection
    this.selectionStartImg = { x: imgLeft, y: imgTop };
    this.selectionEndImg = { x: imgRight, y: imgBottom };
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    const width = Math.round(imgRight - imgLeft);
    const height = Math.round(imgBottom - imgTop);
    if (atom.config.get("image-editor.showSuccessMessages.selection")) {
      atom.notifications.addSuccess("Selected visible area", {
        description: `Selected ${width}×${height} px.`,
      });
    }
  }

  hideSelection() {
    this.setSelectionVisibility(false);
  }

  showPropertiesDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const currentPath = this.editor.getPath();
    if (!currentPath) {
      atom.notifications.addError("No file path available");
      return;
    }

    // Get file stats
    let stats;
    try {
      stats = fs.statSync(currentPath);
    } catch (e) {
      atom.notifications.addError("Cannot read file stats", {
        description: e.message,
      });
      return;
    }

    // Create backdrop
    const backdrop = document.createElement("div");
    backdrop.className = "image-editor-dialog-backdrop";

    const dialogElement = document.createElement("div");
    dialogElement.className = "image-editor-properties-dialog";

    const titleElement = document.createElement("h3");
    titleElement.className = "dialog-title";
    titleElement.textContent = "Image Properties";
    dialogElement.appendChild(titleElement);

    // Create properties table
    const table = document.createElement("table");
    table.className = "properties-table";

    const addRow = (label, value) => {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.className = "property-label";
      labelCell.textContent = label + ":";
      const valueCell = document.createElement("td");
      valueCell.className = "property-value";
      valueCell.textContent = value;
      row.appendChild(labelCell);
      row.appendChild(valueCell);
      table.appendChild(row);
    };

    // File information
    addRow("File name", path.basename(currentPath));
    addRow("Folder", path.dirname(currentPath));
    addRow("Full path", currentPath);

    // Format information
    const ext = path.extname(currentPath).toLowerCase();
    const formatMap = {
      ".png": "PNG",
      ".jpg": "JPEG",
      ".jpeg": "JPEG",
      ".gif": "GIF",
      ".bmp": "BMP",
      ".webp": "WebP",
      ".svg": "SVG",
    };
    addRow("Format", formatMap[ext] || ext.toUpperCase());

    // Dimensions
    const width = this.refs.image.naturalWidth;
    const height = this.refs.image.naturalHeight;
    const megapixels = ((width * height) / 1000000).toFixed(2);
    addRow("Dimensions", `${width} × ${height} pixels (${megapixels} MP)`);

    // Print size (assuming 96 DPI)
    const dpi = 96;
    const printWidthInches = (width / dpi).toFixed(2);
    const printHeightInches = (height / dpi).toFixed(2);
    const printWidthCm = (printWidthInches * 2.54).toFixed(2);
    const printHeightCm = (printHeightInches * 2.54).toFixed(2);
    addRow(
      "Print size (96 DPI)",
      `${printWidthInches} × ${printHeightInches} inches (${printWidthCm} × ${printHeightCm} cm)`
    );

    // File size
    const formatBytes = (bytes) => {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    };
    addRow("Disk size", formatBytes(stats.size));

    // Memory size (uncompressed)
    const memorySize = width * height * 4; // RGBA
    addRow("Memory size", formatBytes(memorySize));

    // File dates
    const formatDate = (date) => {
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };
    addRow("Modified", formatDate(stats.mtime));
    addRow("Created", formatDate(stats.birthtime));

    // Directory position
    const fileList = this.getFileList();
    if (fileList.currentIndex >= 0 && fileList.files.length > 0) {
      addRow(
        "Position in folder",
        `${fileList.currentIndex + 1} / ${fileList.files.length}`
      );
    }

    // History info
    if (this.history.length > 0) {
      addRow(
        "History",
        `${this.historyIndex + 1} / ${this.history.length} states`
      );
    }

    dialogElement.appendChild(table);

    // Analyze colors button (optional, can be slow for large images)
    const analyzeButton = document.createElement("button");
    analyzeButton.className = "btn";
    analyzeButton.textContent = "Analyze Colors";
    analyzeButton.style.marginTop = "10px";
    analyzeButton.style.marginBottom = "10px";

    const colorInfoDiv = document.createElement("div");
    colorInfoDiv.className = "color-info";
    colorInfoDiv.style.marginTop = "10px";

    analyzeButton.addEventListener("click", () => {
      analyzeButton.disabled = true;
      analyzeButton.textContent = "Analyzing...";

      // Use setTimeout to prevent blocking UI
      setTimeout(() => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(this.refs.image, 0, 0);

          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;

          // Count unique colors (sample for large images)
          const sampleRate = width * height > 1000000 ? 10 : 1;
          const colorSet = new Set();
          let hasAlpha = false;

          for (let i = 0; i < data.length; i += 4 * sampleRate) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 255) hasAlpha = true;
            colorSet.add((r << 16) | (g << 8) | b);
          }

          const uniqueColors = colorSet.size;
          const estimatedTotal =
            sampleRate > 1
              ? `~${(uniqueColors * sampleRate).toLocaleString()}`
              : uniqueColors.toLocaleString();

          colorInfoDiv.innerHTML = `
              <table class="properties-table">
                <tr><td class="property-label">Unique colors:</td><td class="property-value">${estimatedTotal}</td></tr>
                <tr><td class="property-label">Color depth:</td><td class="property-value">24-bit RGB${
                  hasAlpha ? " + Alpha" : ""
                }</td></tr>
                <tr><td class="property-label">Transparency:</td><td class="property-value">${
                  hasAlpha ? "Yes" : "No"
                }</td></tr>
              </table>
            `;
          analyzeButton.style.display = "none";
        } catch (e) {
          colorInfoDiv.textContent = "Color analysis failed: " + e.message;
          analyzeButton.disabled = false;
          analyzeButton.textContent = "Analyze Colors";
        }
      }, 10);
    });

    dialogElement.appendChild(analyzeButton);
    dialogElement.appendChild(colorInfoDiv);

    // Close button
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "dialog-buttons";
    buttonContainer.style.marginTop = "15px";

    const closeButton = document.createElement("button");
    closeButton.className = "btn btn-primary";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => {
      document.removeEventListener("keydown", escapeHandler);
      document.body.removeChild(backdrop);
    });

    buttonContainer.appendChild(closeButton);
    dialogElement.appendChild(buttonContainer);

    backdrop.appendChild(dialogElement);
    document.body.appendChild(backdrop);

    // Close on Escape
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", escapeHandler);
        if (document.body.contains(backdrop)) {
          document.body.removeChild(backdrop);
        }
      }
    };
    document.addEventListener("keydown", escapeHandler);

    // Focus close button
    closeButton.focus();
  }

  // Helper method to update image from canvas (saves to history first)

  updateImageFromCanvas(canvas, successMessage, configKey = "adjustment") {
    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    this.updateImageFromCanvasWithoutHistory(canvas, successMessage, configKey);
  }

  // Helper method to update image from canvas without saving to history first
  // Caller is responsible for calling saveToHistory() BEFORE the operation
  // This method will save the result to history AFTER the image loads
  updateImageFromCanvasWithoutHistory(
    canvas,
    successMessage,
    configKey = "adjustment"
  ) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.updateTransform();
        // Don't hide selection - keep it visible for filters/adjustments
        this.emitter.emit("did-update");

        // Save the result to history so redo works
        this.saveToHistory();

        if (atom.config.get(`image-editor.showSuccessMessages.${configKey}`)) {
          atom.notifications.addSuccess(successMessage, {
            description: 'Use "Save" to save changes.',
          });
        }
      };
    }, "image/png");
  }

  // Dialog methods for adjustments with sliders
  showBrightnessContrastDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const panel = this.showAdjustmentDialog(
      "Brightness & Contrast",
      [
        { label: "Brightness", min: -100, max: 100, default: 0, step: 1 },
        { label: "Contrast", min: -100, max: 100, default: 0, step: 1 },
      ],
      (values) => this.applyBrightnessContrast(values[0], values[1])
    );
  }

  showSaturationDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.showAdjustmentDialog(
      "Saturation",
      [{ label: "Saturation", min: -100, max: 100, default: 0, step: 1 }],
      (values) => this.applySaturation(values[0])
    );
  }

  showHueShiftDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.showAdjustmentDialog(
      "Hue Shift",
      [{ label: "Hue", min: 0, max: 360, default: 0, step: 1 }],
      (values) => this.applyHueShift(values[0])
    );
  }

  showPosterizeDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.showAdjustmentDialog(
      "Posterize",
      [{ label: "Levels", min: 2, max: 32, default: 8, step: 1 }],
      (values) => this.applyPosterize(values[0])
    );
  }

  showBlurDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.showAdjustmentDialog(
      "Blur",
      [{ label: "Radius", min: 1, max: 50, default: 12, step: 1 }],
      (values) => this.blurImage(values[0])
    );
  }

  showSharpenDialog() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.showAdjustmentDialog(
      "Sharpen",
      [{ label: "Strength", min: 0.1, max: 3.0, default: 1.0, step: 0.1 }],
      (values) => this.sharpenImage(values[0])
    );
  }

  showAdjustmentDialog(title, sliders, applyCallback) {
    // Create backdrop - fully transparent for click detection only
    const backdrop = document.createElement("div");
    backdrop.className = "image-editor-dialog-backdrop";

    const dialogElement = document.createElement("div");
    dialogElement.className = "image-editor-adjustment-dialog";

    // Make dialog draggable
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;

    const titleElement = document.createElement("h3");
    titleElement.className = "dialog-title";
    titleElement.textContent = title;
    dialogElement.appendChild(titleElement);

    // Add selection info display
    const selectionInfo = document.createElement("div");
    selectionInfo.className = "dialog-selection-info";

    const updateSelectionInfo = () => {
      const area = this.getSelectionArea();
      if (area) {
        if (area.hasSelection) {
          selectionInfo.textContent = `Will apply to selection: ${area.width}×${area.height}px`;
        } else {
          selectionInfo.textContent = "Will apply to entire image";
        }
      }
    };

    updateSelectionInfo();
    dialogElement.appendChild(selectionInfo);

    const dragStart = (e) => {
      if (e.target === titleElement || e.target === dialogElement) {
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;
        isDragging = true;
        dialogElement.style.cursor = "grabbing";
      }
    };

    const drag = (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        dialogElement.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
      }
    };

    const dragEnd = () => {
      isDragging = false;
      dialogElement.style.cursor = "move";
    };

    titleElement.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    // Update selection info when mouse is released (selection changed)
    const selectionUpdateHandler = () => {
      if (!isDragging) {
        updateSelectionInfo();
      }
    };
    document.addEventListener("mouseup", selectionUpdateHandler);

    // Update selection info when selection visibility changes
    const selectionVisibilityHandler = () => {
      updateSelectionInfo();
    };
    this.emitter.on("selection-visibility-changed", selectionVisibilityHandler);

    const sliderElements = [];

    sliders.forEach((config) => {
      const container = document.createElement("div");
      container.className = "dialog-slider-container";

      const label = document.createElement("label");
      label.className = "dialog-label";
      label.textContent = config.label;
      container.appendChild(label);

      const controlsContainer = document.createElement("div");
      controlsContainer.className = "dialog-controls";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = config.min;
      slider.max = config.max;
      slider.value = config.default;
      slider.step = config.step;
      sliderElements.push(slider);

      const valueLabel = document.createElement("span");
      valueLabel.className = "dialog-value-label";
      valueLabel.textContent = config.default;

      slider.addEventListener("input", () => {
        valueLabel.textContent = slider.value;
      });

      controlsContainer.appendChild(slider);
      controlsContainer.appendChild(valueLabel);
      container.appendChild(controlsContainer);
      dialogElement.appendChild(container);
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "dialog-buttons";

    const cancelButton = document.createElement("button");
    cancelButton.className = "btn";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
      document.removeEventListener("mousemove", drag);
      document.removeEventListener("mouseup", dragEnd);
      document.removeEventListener("mouseup", selectionUpdateHandler);
      this.emitter.off(
        "selection-visibility-changed",
        selectionVisibilityHandler
      );
      document.body.removeChild(backdrop);
    });

    const applyButton = document.createElement("button");
    applyButton.className = "btn btn-primary";
    applyButton.textContent = "Apply";
    applyButton.addEventListener("click", () => {
      const values = sliderElements.map((s) => parseFloat(s.value));

      // Call the apply callback with current slider values
      // The callback will use the current selection state via getSelectionArea()
      applyCallback(values);

      // Clean up
      document.removeEventListener("mousemove", drag);
      document.removeEventListener("mouseup", dragEnd);
      document.removeEventListener("mouseup", selectionUpdateHandler);
      this.emitter.off(
        "selection-visibility-changed",
        selectionVisibilityHandler
      );
      document.removeEventListener("keydown", escapeHandler);
      document.body.removeChild(backdrop);
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(applyButton);
    dialogElement.appendChild(buttonContainer);

    backdrop.appendChild(dialogElement);
    document.body.appendChild(backdrop);

    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", dragEnd);
        document.removeEventListener("mouseup", selectionUpdateHandler);
        this.emitter.off(
          "selection-visibility-changed",
          selectionVisibilityHandler
        );
        document.removeEventListener("keydown", escapeHandler);
        if (document.body.contains(backdrop)) {
          document.body.removeChild(backdrop);
        }
      }
    };
    document.addEventListener("keydown", escapeHandler);

    // Focus the first slider
    if (sliderElements.length > 0) {
      sliderElements[0].focus();
    }
  }

  applyBrightnessContrast(brightness, contrast) {
    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    const brightnessAdjust = brightness * 2.55; // Convert -100 to 100 range to -255 to 255
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      // Apply contrast first, then brightness
      for (let c = 0; c < 3; c++) {
        let value = data[i + c];
        // Contrast
        value = contrastFactor * (value - 128) + 128;
        // Brightness
        value = value + brightnessAdjust;
        data[i + c] = Math.min(255, Math.max(0, value));
      }
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Brightness & contrast adjusted on ${areaText}`,
      "adjustment"
    );
  }

  applySaturation(saturation) {
    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    const saturationFactor = (saturation + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      data[i] = Math.min(
        255,
        Math.max(0, gray + saturationFactor * (r - gray))
      );
      data[i + 1] = Math.min(
        255,
        Math.max(0, gray + saturationFactor * (g - gray))
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, gray + saturationFactor * (b - gray))
      );
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Saturation adjusted on ${areaText}`,
      "adjustment"
    );
  }

  autoAdjustColors() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    let area = this.getSelectionArea();

    // If selection is invalid (null), clear it and process entire image
    if (!area) {
      this.hideSelection();
      area = this.getSelectionArea();

      // If still null after clearing selection, something is wrong
      if (!area) {
        atom.notifications.addError("Unable to get image area");
        return;
      }
    }

    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    // Calculate min and max values for each color channel
    let minR = 255,
      maxR = 0;
    let minG = 255,
      maxG = 0;
    let minB = 255,
      maxB = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }

    // Calculate scaling factors for each channel (auto levels)
    const rangeR = maxR - minR;
    const rangeG = maxG - minG;
    const rangeB = maxB - minB;

    // Apply auto levels - stretch each channel to full 0-255 range
    for (let i = 0; i < data.length; i += 4) {
      // Stretch red channel
      if (rangeR > 0) {
        data[i] = Math.min(255, Math.max(0, ((data[i] - minR) * 255) / rangeR));
      }
      // Stretch green channel
      if (rangeG > 0) {
        data[i + 1] = Math.min(
          255,
          Math.max(0, ((data[i + 1] - minG) * 255) / rangeG)
        );
      }
      // Stretch blue channel
      if (rangeB > 0) {
        data[i + 2] = Math.min(
          255,
          Math.max(0, ((data[i + 2] - minB) * 255) / rangeB)
        );
      }
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Auto adjusted colors on ${areaText}`,
      "adjustment"
    );
  }

  applyHueShift(hueShift) {
    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // RGB to HSL
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      // Shift hue
      h = (h + hueShift / 360) % 1;
      if (h < 0) h += 1;

      // HSL to RGB
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      let nr, ng, nb;
      if (s === 0) {
        nr = ng = nb = l;
      } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        nr = hue2rgb(p, q, h + 1 / 3);
        ng = hue2rgb(p, q, h);
        nb = hue2rgb(p, q, h - 1 / 3);
      }

      data[i] = Math.round(nr * 255);
      data[i + 1] = Math.round(ng * 255);
      data[i + 2] = Math.round(nb * 255);
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Hue shifted on ${areaText}`,
      "adjustment"
    );
  }

  applyPosterize(levels) {
    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", {
        description: "Selection has no area.",
      });
      return;
    }

    // Save current state to history before making changes
    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(
      area.left,
      area.top,
      area.width,
      area.height
    );
    const data = imageData.data;

    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.round(Math.round(data[i + c] / step) * step);
      }
    }

    ctx.putImageData(imageData, area.left, area.top);

    const areaText = area.hasSelection ? "selection" : "image";
    this.updateImageFromCanvasWithoutHistory(
      canvas,
      `Posterized to ${levels} levels on ${areaText}`,
      "adjustment"
    );
  }

  // Undo/Redo functionality
  saveToHistory() {
    if (!this.loaded) return;

    // Create a canvas to capture current state using pool
    const canvas = this.getPooledCanvas(
      this.refs.image.naturalWidth,
      this.refs.image.naturalHeight
    );

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(this.refs.image, 0, 0);

    // For large images, use JPEG compression to save memory
    const largeImageThreshold =
      (atom.config.get("image-editor.largeImageThreshold") || 2) * 1024 * 1024;
    const isLargeImage = this.imageSize > largeImageThreshold;

    const dataUrl = isLargeImage
      ? canvas.toDataURL("image/jpeg", 0.95)
      : canvas.toDataURL("image/png");

    // Return canvas to pool after use
    this.returnCanvasToPool(canvas);

    // Store both image state and viewport state
    const historyEntry = {
      imageData: dataUrl,
      translateX: this.translateX,
      translateY: this.translateY,
      zoom: this.zoom,
      auto: this.auto,
      imageWidth: this.refs.image.naturalWidth,
      imageHeight: this.refs.image.naturalHeight,
    };

    // If we're not at the end of history, remove forward history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add to history
    this.history.push(historyEntry);

    // Limit history size (reduce for large images to save memory)
    const maxSize = isLargeImage ? 10 : this.maxHistorySize;
    if (this.history.length > maxSize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    // Emit modified state change
    this.emitModifiedStateIfChanged();
  }

  // Returns true if the image has been modified (history has edits beyond the initial state)
  isModified() {
    // Modified if we have history entries beyond the initial state
    // historyIndex > 0 means we've made at least one edit
    return this.history.length > 1 && this.historyIndex > 0;
  }

  // Emit did-change-modified event if the modified state has changed
  emitModifiedStateIfChanged() {
    const currentModified = this.isModified();
    if (this.lastModifiedState !== currentModified) {
      this.lastModifiedState = currentModified;
      this.editor.emitter.emit("did-change-modified", currentModified);
    }
  }

  // Update the current history entry with the current view state
  updateCurrentHistoryState() {
    if (this.historyIndex < 0 || this.historyIndex >= this.history.length)
      return;

    const entry = this.history[this.historyIndex];
    // Only update if it's an object (new format)
    if (typeof entry !== "string") {
      entry.translateX = this.translateX;
      entry.translateY = this.translateY;
      entry.zoom = this.zoom;
      entry.auto = this.auto;
    }
  }

  undo() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    if (this.historyIndex <= 0) {
      atom.notifications.addWarning("Nothing to undo", {
        description: "Already at the oldest change.",
      });
      return;
    }

    this.historyIndex--;
    this.loadFromHistory();
    this.emitModifiedStateIfChanged();

    if (atom.config.get("image-editor.showSuccessMessages.history")) {
      atom.notifications.addSuccess("Undo", {
        description: `Reverted to previous state (${this.historyIndex + 1}/${
          this.history.length
        }).`,
      });
    }
  }

  redo() {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    if (this.historyIndex >= this.history.length - 1) {
      atom.notifications.addWarning("Nothing to redo", {
        description: "Already at the newest change.",
      });
      return;
    }

    this.historyIndex++;
    this.loadFromHistory();
    this.emitModifiedStateIfChanged();

    if (atom.config.get("image-editor.showSuccessMessages.history")) {
      atom.notifications.addSuccess("Redo", {
        description: `Restored to next state (${this.historyIndex + 1}/${
          this.history.length
        }).`,
      });
    }
  }

  loadFromHistory() {
    if (this.historyIndex < 0 || this.historyIndex >= this.history.length)
      return;

    const historyEntry = this.history[this.historyIndex];

    // Capture current auto state to respect user preference
    const wasAuto = this.auto;
    const prevWidth = this.refs.image.naturalWidth;
    const prevHeight = this.refs.image.naturalHeight;

    // Support old history format (just strings) for backward compatibility
    const dataUrl =
      typeof historyEntry === "string" ? historyEntry : historyEntry.imageData;

    const img = new Image();
    img.onload = () => {
      this.refs.image.src = dataUrl;

      // Synchronously update dimensions from the pre-loaded image
      this.originalHeight = img.naturalHeight;
      this.originalWidth = img.naturalWidth;

      // User requested: "undo"/"redo" do not change view zoom & auto setting
      // We ignore the viewport state from history and preserve the current state.

      // Re-apply auto-zoom if active to ensure new image fits
      if (this.auto === true) {
        this.zoomToFit();
      } else if (this.auto === 1) {
        this.zoomTo100();
      } else {
        // If auto is OFF, check if dimensions changed (crop/resize)
        // If so, we should restore the previous view state (inverted logic)
        // This restores the translation/zoom from BEFORE the crop
        if (
          typeof historyEntry !== "string" &&
          (this.originalWidth !== prevWidth ||
            this.originalHeight !== prevHeight)
        ) {
          this.zoom = historyEntry.zoom;
          this.translateX = historyEntry.translateX;
          this.translateY = historyEntry.translateY;
        }

        // Apply transform synchronously to prevent flicker
        this._applyTransform();
      }

      this.setSelectionVisibility(false);
      this.emitter.emit("did-update");
    };
    img.src = dataUrl;
  }
};
