/**
 * ImageEditorView - Main view component for the image editor
 * Orchestrates all modules for image editing functionality
 */

const fs = require("fs");
const path = require("path");
const { Emitter, CompositeDisposable, Disposable } = require("atom");
const etch = require("etch");
const $ = etch.dom;

// Import modular components
const filters = require("./filters");
const transforms = require("./transforms");
const dialogs = require("./dialogs");
const fileOps = require("./file-ops");
const HistoryManager = require("./history");
const ImageNavigator = require("./navigation");
const selection = require("./selection");
const CanvasPool = require("./canvas-pool");
const ZoomController = require("./zoom-controller");
const ImageLoader = require("./image-loader");
const MouseEventHandler = require("./view-mouse");
const viewOperations = require("./view-operations");

module.exports = class ImageEditorView {
  constructor(editor) {
    this.editor = editor;
    this.emitter = new Emitter();
    this.disposables = new CompositeDisposable();
    this.imageSize = fs.statSync(this.editor.getPath()).size;
    this.loaded = false;
    this.selectionStartImg = { x: 0, y: 0 };
    this.selectionEndImg = { x: 0, y: 0 };
    this.isSaving = false;

    // Initialize modular components
    this.canvasPool = new CanvasPool(3);
    this.zoomController = new ZoomController({
      levels: [0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2, 3, 4, 5, 7.5, 10]
    });
    this.imageLoader = new ImageLoader();
    this.mouseHandler = new MouseEventHandler(this);

    // Expose zoom/translate for compatibility
    Object.defineProperty(this, 'zoom', {
      get: () => this.zoomController.zoom,
      set: (value) => { this.zoomController.zoom = value; }
    });
    Object.defineProperty(this, 'translateX', {
      get: () => this.zoomController.translateX,
      set: (value) => { this.zoomController.translateX = value; }
    });
    Object.defineProperty(this, 'translateY', {
      get: () => this.zoomController.translateY,
      set: (value) => { this.zoomController.translateY = value; }
    });
    Object.defineProperty(this, 'auto', {
      get: () => this.zoomController.auto,
      set: (value) => { this.zoomController.auto = value; }
    });

    // Initialize history manager
    this.historyManager = new HistoryManager({
      maxHistorySize: atom.config.get("image-editor.maxHistorySize") || 50,
      largeImageThreshold: (atom.config.get("image-editor.largeImageThreshold") || 2) * 1024 * 1024,
      onModifiedStateChange: (modified) => {
        this.editor.emitter.emit("did-change-modified", modified);
      },
    });

    // Initialize navigator
    this.navigator = new ImageNavigator({
      extensions: [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"],
      treeView: this.editor.treeView,
    });

    // Performance optimizations
    this.lastWheelTime = 0;
    this.wheelDebounceDelay = atom.config.get("image-editor.wheelNavigationDelay") || 150;

    etch.initialize(this);

    this.defaultBackgroundColor = atom.config.get("image-editor.defaultBackgroundColor");
    this.refs.imageContainer.setAttribute("background", this.defaultBackgroundColor);
    this.refs.image.style.display = "none";
    this.updateImageURI();

    this._setupDisposables();
    this._setupTooltips();
    this._setupEventListeners();
    this.setupResizeHandles();
  }

  _setupDisposables() {
    this.disposables.add(this.editor.onDidReplaceFile(() => this.updateImageURI()));
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
        "core:cancel": () => this.hideSelection(),
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
        "image-editor:rotate-free": () => this.showFreeRotateDialog(),
        "image-editor:flip-horizontal": () => this.flipHorizontal(),
        "image-editor:flip-vertical": () => this.flipVertical(),
        "image-editor:resize": () => this.showResizeDialog(),
        "image-editor:grayscale": () => this.applyGrayscale(),
        "image-editor:invert-colors": () => this.invertColors(),
        "image-editor:sepia": () => this.applySepia(),
        "image-editor:sharpen-light": () => this.sharpenImage(0.5),
        "image-editor:sharpen-medium": () => this.sharpenImage(1.0),
        "image-editor:sharpen-strong": () => this.sharpenImage(1.5),
        "image-editor:sharpen": () => this.showSharpenDialog(),
        "image-editor:brightness-contrast": () => this.showBrightnessContrastDialog(),
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
        "image-editor:edit-in-paint": () => this.editInPaint(),
        "image-editor:move": () => this.moveFile(),
        "image-editor:duplicate": () => this.duplicateFile(),
      })
    );
  }

  _setupTooltips() {
    const tooltips = [
      [this.refs.whiteTransparentBackgroundButton, { title: "Use white transparent background" }],
      [this.refs.blackTransparentBackgroundButton, { title: "Use black transparent background" }],
      [this.refs.transparentTransparentBackgroundButton, { title: "Use transparent background" }],
      [this.refs.nativeBackgroundButton, { title: "Use native background" }],
      [this.refs.firstImageButton, { title: "Navigate to the first image in the current directory", keyBindingCommand: "image-editor:first-image" }],
      [this.refs.prevImageButton, { title: "Navigate to the previous image", keyBindingCommand: "image-editor:previous-image" }],
      [this.refs.undoButton, { title: "Undo last change", keyBindingCommand: "image-editor:undo" }],
      [this.refs.redoButton, { title: "Redo last undone change", keyBindingCommand: "image-editor:redo" }],
      [this.refs.nextImageButton, { title: "Navigate to the next image", keyBindingCommand: "image-editor:next-image" }],
      [this.refs.lastImageButton, { title: "Navigate to the last image in the current directory", keyBindingCommand: "image-editor:last-image" }],
      [this.refs.zoomOutButton, { title: "Decrease zoom level", keyBindingCommand: "image-editor:zoom-out" }],
      [this.refs.resetZoomButton, { title: "Reset zoom to default", keyBindingCommand: "image-editor:reset-zoom" }],
      [this.refs.zoomInButton, { title: "Increase zoom level", keyBindingCommand: "image-editor:zoom-in" }],
      [this.refs.centerButton, { title: "Center the image within the pane", keyBindingCommand: "image-editor:center" }],
      [this.refs.zoomToFitButton, { title: "Scale image to fit the window", keyBindingCommand: "image-editor:zoom-to-fit" }],
      [this.refs.zoomTo100Button, { title: "Scale image to fit, but not more than 100%", keyBindingCommand: "image-editor:zoom-to-100" }],
    ];

    tooltips.forEach(([element, options]) => {
      this.disposables.add(atom.tooltips.add(element, options));
    });
  }

  _setupEventListeners() {
    const clickHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.changeBackground(event.target.value);
    };

    const buttonHandlers = [
      [this.refs.whiteTransparentBackgroundButton, "click", clickHandler],
      [this.refs.blackTransparentBackgroundButton, "click", clickHandler],
      [this.refs.transparentTransparentBackgroundButton, "click", clickHandler],
      [this.refs.nativeBackgroundButton, "click", clickHandler],
      [this.refs.zoomInButton, "click", () => this.zoomIn()],
      [this.refs.zoomOutButton, "click", () => this.zoomOut()],
      [this.refs.resetZoomButton, "click", () => this.resetZoom()],
      [this.refs.undoButton, "click", () => this.undo()],
      [this.refs.redoButton, "click", () => this.redo()],
      [this.refs.prevImageButton, "click", () => this.previousImage()],
      [this.refs.firstImageButton, "click", () => this.firstImage()],
      [this.refs.nextImageButton, "click", () => this.nextImage()],
      [this.refs.lastImageButton, "click", () => this.lastImage()],
      [this.refs.centerButton, "click", () => this.centerImage()],
      [this.refs.zoomToFitButton, "click", () => this.zoomToFit()],
      [this.refs.zoomTo100Button, "click", () => this.zoomTo100()],
    ];

    buttonHandlers.forEach(([element, event, handler]) => {
      element.addEventListener(event, handler);
      this.disposables.add(new Disposable(() => element.removeEventListener(event, handler)));
    });

    const wheelContainerHandler = (event) => {
      if (event.ctrlKey) {
        event.stopPropagation();
        const factor = event.wheelDeltaY > 0 ? 1.2 : 1 / 1.2;
        this.zoomToMousePosition(factor * this.zoom, event);
      } else {
        const now = Date.now();
        if (this.lastWheelTime && now - this.lastWheelTime < this.wheelDebounceDelay) {
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
    this.disposables.add(new Disposable(() => this.refs.imageContainer.removeEventListener("wheel", wheelContainerHandler)));

    this.resizeObserver = new ResizeObserver(() => {
      if (this.auto === 1) {
        this.zoomTo100();
      } else if (this.auto) {
        this.zoomToFit();
      }
    });
    this.resizeObserver.observe(this.refs.imageContainer);

    this._setupMouseHandlers();
  }

  _setupMouseHandlers() {
    this.mouseMoveHandler = (event) => this.mouseHandler.handleMouseMove(event);
    this.mouseDownHandler = (event) => this.mouseHandler.handleMouseDown(event);
    this.mouseUpHandler = () => this.mouseHandler.handleMouseUp();
    this.contextMenuHandler = (event) => this.mouseHandler.handleContextMenu(event);

    this.refs.imageContainer.addEventListener("mousedown", this.mouseDownHandler);
    this.refs.imageContainer.addEventListener("contextmenu", this.contextMenuHandler);
    window.addEventListener("mousemove", this.mouseMoveHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);

    this.disposables.add(new Disposable(() => {
      this.refs.imageContainer.removeEventListener("mousedown", this.mouseDownHandler);
      this.refs.imageContainer.removeEventListener("contextmenu", this.contextMenuHandler);
      window.removeEventListener("mousemove", this.mouseMoveHandler);
      window.removeEventListener("mouseup", this.mouseUpHandler);
    }));
  }

  _normalizeSelection() {
    const minX = Math.min(this.selectionStartImg.x, this.selectionEndImg.x);
    const maxX = Math.max(this.selectionStartImg.x, this.selectionEndImg.x);
    const minY = Math.min(this.selectionStartImg.y, this.selectionEndImg.y);
    const maxY = Math.max(this.selectionStartImg.y, this.selectionEndImg.y);
    this.selectionStartImg = { x: minX, y: minY };
    this.selectionEndImg = { x: maxX, y: maxY };
    this.updateSelectionBox();
  }

  _checkSelectionSize() {
    const selWidth = Math.abs(this.selectionEndImg.x - this.selectionStartImg.x);
    const selHeight = Math.abs(this.selectionEndImg.y - this.selectionStartImg.y);
    const minSize = 3 / this.zoom;
    if (selWidth < minSize && selHeight < minSize) {
      this.refs.selectionBox.style.display = "none";
    }
  }

  onDidLoad(callback) {
    return this.emitter.on("did-load", callback);
  }

  onMousePosition(callback) {
    return this.emitter.on("mouse-position", callback);
  }

  onDidUpdate(callback) {
    return this.emitter.on("did-update", callback);
  }

  update() {}

  destroy() {
    this.disposables.dispose();
    this.emitter.dispose();
    this.resizeObserver.disconnect();
    this.navigator.clearCache();
    this.canvasPool.clear();
    this.imageLoader.cancelLoad();
    etch.destroy(this);
  }

  showSpinner() {
    if (this.refs.loadingSpinner) {
      this.refs.loadingSpinner.style.display = "";
    }
  }

  hideSpinner() {
    if (this.refs.loadingSpinner) {
      this.refs.loadingSpinner.style.display = "none";
    }
  }

  setupResizeHandles() {
    const corners = ["nw", "ne", "se", "sw"];
    corners.forEach((handle) => {
      const refName = "handle" + handle.toUpperCase();
      const element = this.refs[refName];
      const handleMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.mouseHandler.startResizing(handle);
      };
      element.addEventListener("mousedown", handleMouseDown);
      this.disposables.add(new Disposable(() => element.removeEventListener("mousedown", handleMouseDown)));
    });

    const edges = ["n", "e", "s", "w"];
    edges.forEach((edge) => {
      const refName = "edge" + edge.toUpperCase();
      const element = this.refs[refName];
      const handleMouseDown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.mouseHandler.startResizing(edge);
      };
      element.addEventListener("mousedown", handleMouseDown);
      this.disposables.add(new Disposable(() => element.removeEventListener("mousedown", handleMouseDown)));
    });
  }

  render() {
    return $.div(
      { className: "image-editor", tabIndex: -1 },
      $.div(
        { className: "image-controls", ref: "imageControls" },
        $.div(
          { className: "image-controls-group image-controls-group-background" },
          $.a({ className: "image-controls-color-white", value: "white", ref: "whiteTransparentBackgroundButton" }, "white"),
          $.a({ className: "image-controls-color-black", value: "black", ref: "blackTransparentBackgroundButton" }, "black"),
          $.a({ className: "image-controls-color-transparent", value: "transparent", ref: "transparentTransparentBackgroundButton" }, "transparent"),
          $.a({ className: "image-controls-color-native", value: "native", ref: "nativeBackgroundButton" }, "native")
        ),
        $.div(
          { className: "image-controls-group image-controls-group-navigation btn-group" },
          $.button({ className: "btn", ref: "firstImageButton" }, "<<"),
          $.button({ className: "btn", ref: "prevImageButton" }, "<"),
          $.button({ className: "btn", ref: "undoButton" }, "↶"),
          $.button({ className: "btn", ref: "zoomOutButton" }, "-"),
          $.button({ className: "btn reset-zoom-button", ref: "resetZoomButton" }, ""),
          $.button({ className: "btn", ref: "zoomInButton" }, "+"),
          $.button({ className: "btn", ref: "redoButton" }, "↷"),
          $.button({ className: "btn", ref: "nextImageButton" }, ">"),
          $.button({ className: "btn", ref: "lastImageButton" }, ">>")
        ),
        $.div(
          { className: "image-controls-group image-controls-group-zoom btn-group" },
          $.span({ className: "loading loading-spinner-tiny inline-block", ref: "loadingSpinner", style: "float: left; margin-right: 10px; margin-top: 6px; display: none;" }),
          $.button({ className: "btn center-button", ref: "centerButton" }, "Center"),
          $.button({ className: "btn zoom-to-fit-button", ref: "zoomToFitButton" }, "Zoom to fit"),
          $.button({ className: "btn zoom-to-100-button", ref: "zoomTo100Button" }, "Zoom to 100")
        )
      ),
      $.div(
        { className: "image-container", ref: "imageContainer" },
        $.img({ ref: "image" }),
        $.div({ className: "boundary-overlay", ref: "boundaryOverlay" }),
        $.div(
          { className: "selection-box", ref: "selectionBox" },
          $.div({ className: "selection-edge edge-n", ref: "edgeN" }),
          $.div({ className: "selection-edge edge-e", ref: "edgeE" }),
          $.div({ className: "selection-edge edge-s", ref: "edgeS" }),
          $.div({ className: "selection-edge edge-w", ref: "edgeW" }),
          $.div({ className: "selection-handle nw", ref: "handleNW" }),
          $.div({ className: "selection-handle ne", ref: "handleNE" }),
          $.div({ className: "selection-handle se", ref: "handleSE" }),
          $.div({ className: "selection-handle sw", ref: "handleSW" })
        )
      )
    );
  }

  async updateImageURI() {
    if (this.isSaving) return;

    if (this.loadingAbortController) {
      this.loadingAbortController.cancelled = true;
    }

    this.loadingAbortController = { cancelled: false };
    const currentLoad = this.loadingAbortController;

    this.showSpinner();

    try {
      this.imageSize = fs.statSync(this.editor.getPath()).size;
    } catch (e) {
      this.imageSize = 0;
    }

    const loadStartTime = Date.now();
    const imageUrl = `${this.editor.getEncodedURI()}?time=${Date.now()}`;
    const largeImageThreshold = (atom.config.get("image-editor.largeImageThreshold") || 2) * 1024 * 1024;
    const isLargeImage = this.imageSize > largeImageThreshold;

    try {
      await this.loadImageOptimized(imageUrl, isLargeImage, loadStartTime, currentLoad);
    } catch (error) {
      if (!currentLoad.cancelled) {
        const isDecodeError = error.name === "DOMException" && error.message.includes("decode");
        if (!isDecodeError) {
          console.error("Error loading image:", error);
        }
        this.loaded = false;
        this.hideSpinner();
        if (!isDecodeError) {
          atom.notifications.addError("Failed to load image", { description: error.message, dismissable: true });
        }
      }
    }
  }

  async loadImageOptimized(imageUrl, isLargeImage, loadStartTime, currentLoad) {
    return new Promise((resolve, reject) => {
      this.refs.image.src = imageUrl;

      this.refs.image.onload = async () => {
        try {
          if (currentLoad.cancelled) {
            resolve();
            return;
          }

          if (isLargeImage && this.refs.image.decode) {
            try {
              await this.refs.image.decode();
            } catch (decodeError) {
              if (currentLoad.cancelled) {
                resolve();
                return;
              }
              console.warn("Image decode failed, continuing without async decode:", decodeError.message);
            }
          }

          if (currentLoad.cancelled) {
            resolve();
            return;
          }

          this.refs.image.onload = null;
          this.originalHeight = this.refs.image.naturalHeight;
          this.originalWidth = this.refs.image.naturalWidth;
          this.loaded = true;
          this.translateX = 0;
          this.translateY = 0;

          this.zoomTo100();
          this.centerImage();
          this.refs.image.style.display = "";

          this.historyManager.reset();
          this.emitter.emit("did-update");
          this.emitter.emit("did-load");
          this.hideSpinner();

          this.navigator.invalidateCache();
          setTimeout(() => this.preloadAdjacentImages(), 100);

          resolve();
        } catch (error) {
          reject(error);
        }
      };

      this.refs.image.onerror = () => {
        this.refs.image.onerror = null;
        this.loaded = false;
        this.hideSpinner();
        if (currentLoad.cancelled) {
          resolve();
        } else {
          reject(new Error("Failed to load image"));
        }
      };
    });
  }

  getPooledCanvas(width, height) {
    return this.canvasPool.getCanvas(width, height);
  }

  returnCanvasToPool(canvas) {
    this.canvasPool.returnCanvas(canvas);
  }

  preloadAdjacentImages() {
    if (!atom.config.get("image-editor.enablePreloading")) return;
    this.navigator.preloadAdjacentImages(
      this.editor.getPath(),
      this.refs.imageContainer.offsetWidth,
      this.refs.imageContainer.offsetHeight,
      this.zoom,
      this.auto
    );
  }

  updateSize(zoom) {
    if (!this.loaded || this.element.offsetHeight === 0) return;
    this.disableAutoZoom();
    this.zoom = Math.min(Math.max(zoom, 0.001), 100);
    this.updateTransform();
  }

  updateTransform() {
    if (!this.transformRAF) {
      this.transformRAF = requestAnimationFrame(() => {
        this.transformRAF = null;
        this._applyTransform();
      });
    }
  }

  _applyTransform() {
    this.refs.image.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoom})`;
    this.refs.image.style.willChange = "transform";
    this.refs.image.style.width = "";
    this.refs.image.style.height = "";

    const percent = Math.round(this.zoom * 1000) / 10;
    this.refs.resetZoomButton.textContent = percent + "%";

    if (this.refs.selectionBox && this.refs.selectionBox.style.display === "block") {
      this.updateSelectionBox();
    }
  }

  updateSelectionBox() {
    if (!this.refs.selectionBox) return;
    selection.updateSelectionBoxStyle(
      this.refs.selectionBox,
      this.selectionStartImg,
      this.selectionEndImg,
      this.translateX,
      this.translateY,
      this.zoom
    );
  }

  centerImage() {
    if (!this.loaded || this.element.offsetHeight === 0) return;

    const containerWidth = this.refs.imageContainer.offsetWidth;
    const containerHeight = this.refs.imageContainer.offsetHeight;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    if (this.originX === 0 && this.originY === 0) {
      this.originX = centerX;
      this.originY = centerY;
    }

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

    const imageX = (mouseX - this.translateX) / this.zoom;
    const imageY = (mouseY - this.translateY) / this.zoom;

    this.updateSize(newZoom);

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
    if (!this.loaded || this.element.offsetHeight === 0) return;
    let zoom = Math.min(
      this.refs.imageContainer.offsetWidth / this.refs.image.naturalWidth,
      this.refs.imageContainer.offsetHeight / this.refs.image.naturalHeight
    );
    if (limit) zoom = Math.min(zoom, limit);
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
    if (!this.loaded || this.element.offsetHeight === 0) return;
    this.zoomToCenterPoint(1);
  }

  hideSelection() {
    if (this.refs.selectionBox) {
      this.refs.selectionBox.style.display = "none";
    }
    this.mouseHandler.reset();
  }

  disableAutoZoom() {
    this.auto = false;
    if (this.refs.zoomToFitButton) this.refs.zoomToFitButton.classList.remove("selected");
    if (this.refs.zoomTo100Button) this.refs.zoomTo100Button.classList.remove("selected");
  }

  changeBackground(color) {
    if (this.loaded && this.element.offsetHeight > 0 && color) {
      this.refs.imageContainer.setAttribute("background", color);
    }
  }

  scrollUp() { this.disableAutoZoom(); this.translateY += this.refs.imageContainer.offsetHeight / 10; this.updateTransform(); }
  scrollDown() { this.disableAutoZoom(); this.translateY -= this.refs.imageContainer.offsetHeight / 10; this.updateTransform(); }
  scrollLeft() { this.disableAutoZoom(); this.translateX += this.refs.imageContainer.offsetWidth / 10; this.updateTransform(); }
  scrollRight() { this.disableAutoZoom(); this.translateX -= this.refs.imageContainer.offsetWidth / 10; this.updateTransform(); }
  pageUp() { this.disableAutoZoom(); this.translateY += this.refs.imageContainer.offsetHeight; this.updateTransform(); }
  pageDown() { this.disableAutoZoom(); this.translateY -= this.refs.imageContainer.offsetHeight; this.updateTransform(); }
  scrollToTop() { this.disableAutoZoom(); this.translateY = 0; this.updateTransform(); }
  scrollToBottom() { this.disableAutoZoom(); this.translateY = this.refs.imageContainer.offsetHeight - this.refs.image.naturalHeight * this.zoom; this.updateTransform(); }

  nextImage() {
    const now = Date.now();
    if (this.lastNavigationTime && now - this.lastNavigationTime < 50) return;
    this.lastNavigationTime = now;

    if (this.navigator.isAtEnd(this.editor.getPath())) {
      this.showBoundaryOverlay("right");
    }

    const nextPath = this.navigator.getNextImage(this.editor.getPath());
    if (nextPath && path.normalize(nextPath) !== path.normalize(this.editor.getPath())) {
      this.loadImageWithoutFlicker(nextPath);
    }
  }

  previousImage() {
    const now = Date.now();
    if (this.lastNavigationTime && now - this.lastNavigationTime < 50) return;
    this.lastNavigationTime = now;

    if (this.navigator.isAtStart(this.editor.getPath())) {
      this.showBoundaryOverlay("left");
    }

    const prevPath = this.navigator.getPreviousImage(this.editor.getPath());
    if (prevPath && path.normalize(prevPath) !== path.normalize(this.editor.getPath())) {
      this.loadImageWithoutFlicker(prevPath);
    }
  }

  showBoundaryOverlay(direction) {
    if (!this.refs.boundaryOverlay) return;
    const overlay = this.refs.boundaryOverlay;
    const iconClass = direction === "left" ? "icon-move-down" : "icon-move-up";
    overlay.className = `boundary-overlay icon ${iconClass}`;
    overlay.offsetHeight;
    overlay.classList.add("active");
    if (this.boundaryOverlayTimeout) clearTimeout(this.boundaryOverlayTimeout);
    this.boundaryOverlayTimeout = setTimeout(() => overlay.classList.remove("active"), 800);
  }

  firstImage() {
    const firstPath = this.navigator.getFirstImage(this.editor.getPath());
    if (firstPath && path.normalize(firstPath) !== path.normalize(this.editor.getPath())) {
      this.loadImageWithoutFlicker(firstPath);
    }
  }

  lastImage() {
    const lastPath = this.navigator.getLastImage(this.editor.getPath());
    if (lastPath && path.normalize(lastPath) !== path.normalize(this.editor.getPath())) {
      this.loadImageWithoutFlicker(lastPath);
    }
  }

  // Public API for external packages (e.g., navigation-panel)
  getFileList() {
    return this.navigator.getFileList(this.editor.getPath());
  }

  loadImageWithoutFlicker(imagePath) {
    if (!imagePath) return;

    if (this.navigator.isPreloaded(imagePath)) {
      const preloadedData = this.navigator.getPreloadedData(imagePath);
      this.applyPreloadedImageWithMetadata(imagePath, preloadedData);
    } else {
      this.showSpinner();
      const encodedPath = `${this.navigator.encodeFilePath(imagePath)}?time=${Date.now()}`;
      const tempImg = new Image();
      tempImg.onload = () => {
        const preloadedData = this.calculateZoomForImage(tempImg, encodedPath);
        this.applyPreloadedImageWithMetadata(imagePath, preloadedData);
        this.hideSpinner();
      };
      tempImg.onerror = () => {
        this.hideSpinner();
        atom.notifications.addError("Failed to load image", { description: `Could not load ${imagePath}` });
      };
      tempImg.src = encodedPath;
    }
  }

  calculateZoomForImage(img, encodedPath) {
    const newWidth = img.naturalWidth;
    const newHeight = img.naturalHeight;
    let zoom, translateX, translateY;

    if (this.auto === true) {
      zoom = Math.min(this.refs.imageContainer.offsetWidth / newWidth, this.refs.imageContainer.offsetHeight / newHeight);
    } else if (this.auto === 1) {
      zoom = Math.min(1.0, Math.min(this.refs.imageContainer.offsetWidth / newWidth, this.refs.imageContainer.offsetHeight / newHeight));
    } else {
      zoom = this.zoom;
    }

    const imageWidth = newWidth * zoom;
    const imageHeight = newHeight * zoom;
    translateX = (this.refs.imageContainer.offsetWidth - imageWidth) / 2;
    translateY = (this.refs.imageContainer.offsetHeight - imageHeight) / 2;

    return { img, encodedPath, width: newWidth, height: newHeight, zoom, translateX, translateY };
  }

  applyPreloadedImageWithMetadata(imagePath, preloadedData) {
    this.refs.image.src = preloadedData.encodedPath;
    this.originalWidth = preloadedData.width;
    this.originalHeight = preloadedData.height;
    this.zoom = preloadedData.zoom;
    this.translateX = preloadedData.translateX;
    this.translateY = preloadedData.translateY;

    this._applyTransform();
    this.editor.load(imagePath);
    this.historyManager.reset();
    this.refs.selectionBox.style.display = "none";
    this.emitter.emit("did-update");
    this.emitter.emit("did-load");

    setTimeout(() => this.preloadAdjacentImages(), 100);
  }

  ensureInitialHistorySaved() {
    this.historyManager.ensureInitialSaved(() => this.saveToHistory());
  }

  getSelectionArea() {
    const hasVisibleSelection = this.refs.selectionBox && this.refs.selectionBox.style.display !== "none";
    return selection.getSelectionArea(
      this.selectionStartImg,
      this.selectionEndImg,
      this.refs.image.naturalWidth,
      this.refs.image.naturalHeight,
      hasVisibleSelection
    );
  }

  setSelectionVisibility(visible) {
    this.refs.selectionBox.style.display = visible ? "block" : "none";
    this.emitter.emit("selection-visibility-changed", visible);
  }

  cropToSelection() {
    if (!this.refs.selectionBox || this.refs.selectionBox.style.display === "none") {
      atom.notifications.addWarning("No selection", { description: "Please create a selection first by dragging with the left mouse button." });
      return;
    }
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    this.historyManager.updateCurrentState({ translateX: this.translateX, translateY: this.translateY, zoom: this.zoom, auto: this.auto });

    const area = this.getSelectionArea();
    if (!area || area.width === 0 || area.height === 0) {
      atom.notifications.addWarning("Invalid selection", { description: "Selection has no area." });
      return;
    }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const canvas = transforms.cropImage(
      transforms.imageToCanvas(this.refs.image),
      area.left, area.top, area.width, area.height
    );

    const cropCenterX = this.translateX + (area.left + area.width / 2) * this.zoom;
    const cropCenterY = this.translateY + (area.top + area.height / 2) * this.zoom;

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      const tempImg = new Image();
      tempImg.onload = () => {
        this.refs.image.src = url;
        this.originalHeight = tempImg.naturalHeight;
        this.originalWidth = tempImg.naturalWidth;

        if (this.auto === true) {
          this.zoomToFit();
        } else if (this.auto === 1) {
          this.zoomTo100();
        } else {
          const newImageWidth = this.originalWidth * this.zoom;
          const newImageHeight = this.originalHeight * this.zoom;
          this.translateX = cropCenterX - newImageWidth / 2;
          this.translateY = cropCenterY - newImageHeight / 2;
          this.updateTransform();
        }

        this.setSelectionVisibility(false);
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.crop")) {
          atom.notifications.addSuccess("Image cropped", { description: 'Image has been cropped to selection. Use "Save" to save changes.' });
        }
      };
      tempImg.onerror = () => this.hideSpinner();
      tempImg.src = url;
    });
  }

  blurImage(blurLevel) {
    this.applyImageFilter("blur", blurLevel);
  }

  sharpenImage(strength) {
    this.applyImageFilter("sharpen", strength);
  }

  applyImageFilter(filterType, strength) {
    if (!this.loaded) {
      atom.notifications.addError("Image not loaded");
      return;
    }

    const area = this.getSelectionArea();
    if (!area) {
      atom.notifications.addWarning("Invalid selection", { description: "Selection has no area." });
      return;
    }

    this.ensureInitialHistorySaved();

    const { left, top, width, height, hasSelection } = area;
    const isLargeArea = width * height > 2000000;
    if (isLargeArea) {
      const filterName = filterType === "blur" ? "blur" : "sharpen";
      atom.notifications.addInfo(`Processing ${filterName}...`, { description: "This may take a moment for large images.", dismissable: true });
    }

    setTimeout(() => {
      const canvas = document.createElement("canvas");
      canvas.width = this.refs.image.naturalWidth;
      canvas.height = this.refs.image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(this.refs.image, 0, 0);

      const imageData = ctx.getImageData(left, top, width, height);

      if (filterType === "blur") {
        filters.fastGaussianBlur(imageData, width, height, strength * 2);
      } else if (filterType === "sharpen") {
        filters.applySharpenKernel(imageData, width, height, strength);
      }

      ctx.putImageData(imageData, left, top);

      const areaText = hasSelection ? "selection" : "image";
      let message = filterType === "blur"
        ? `Blur level ${strength} applied to ${areaText}`
        : `Sharpen applied to ${areaText}`;

      this.updateImageFromCanvasWithoutHistory(canvas, message, filterType === "blur" ? "blur" : "adjustment");
    }, 10);
  }

  applyGrayscale() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applyGrayscale(imageData);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Grayscale applied to ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  invertColors() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.invertColors(imageData);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Colors inverted on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  applySepia() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applySepia(imageData);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Sepia tone applied to ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  applyBrightnessContrast(brightness, contrast) {
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applyBrightnessContrast(imageData, brightness, contrast);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Brightness & contrast adjusted on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  applySaturation(saturation) {
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applySaturation(imageData, saturation);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Saturation adjusted on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  applyHueShift(hueShift) {
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applyHueShift(imageData, hueShift);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Hue shifted on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  applyPosterize(levels) {
    const area = this.getSelectionArea();
    if (!area) { atom.notifications.addWarning("Invalid selection"); return; }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.applyPosterize(imageData, levels);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Posterized to ${levels} levels on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  autoAdjustColors() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    let area = this.getSelectionArea();
    if (!area) {
      this.hideSelection();
      area = this.getSelectionArea();
      if (!area) { atom.notifications.addError("Unable to get image area"); return; }
    }

    this.ensureInitialHistorySaved();

    const canvas = document.createElement("canvas");
    canvas.width = this.refs.image.naturalWidth;
    canvas.height = this.refs.image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.refs.image, 0, 0);

    const imageData = ctx.getImageData(area.left, area.top, area.width, area.height);
    filters.autoAdjustColors(imageData);
    ctx.putImageData(imageData, area.left, area.top);

    this.updateImageFromCanvasWithoutHistory(canvas, `Auto adjusted colors on ${area.hasSelection ? "selection" : "image"}`, "adjustment");
  }

  updateImageFromCanvasWithoutHistory(canvas, successMessage, configKey = "adjustment") {
    this.showSpinner();

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get(`image-editor.showSuccessMessages.${configKey}`)) {
          atom.notifications.addSuccess(successMessage, { description: 'Use "Save" to save changes.' });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    }, "image/png");
  }

  rotate(degrees) {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const canvas = transforms.rotateImage(transforms.imageToCanvas(this.refs.image), degrees);

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.originalHeight = this.refs.image.naturalHeight;
        this.originalWidth = this.refs.image.naturalWidth;

        if (this.auto === true) this.zoomToFit();
        else if (this.auto === 1) this.zoomTo100();
        else this.updateTransform();

        this.refs.selectionBox.style.display = "none";
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          const direction = degrees > 0 ? "clockwise" : "counter-clockwise";
          atom.notifications.addSuccess("Image rotated", { description: `Rotated ${Math.abs(degrees)}° ${degrees === 180 ? "" : direction}. Use "Save" to save changes.` });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    });
  }

  freeRotate(degrees, expandCanvas = true) {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const canvas = transforms.freeRotateImage(transforms.imageToCanvas(this.refs.image), degrees, expandCanvas);

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.originalWidth = this.refs.image.naturalWidth;
        this.originalHeight = this.refs.image.naturalHeight;

        if (this.auto === true) this.zoomToFit();
        else if (this.auto === 1) this.zoomTo100();
        else this.updateTransform();

        this.refs.selectionBox.style.display = "none";
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image rotated", { description: `Rotated ${degrees}°. Use "Save" to save changes.` });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    });
  }

  flipHorizontal() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const canvas = transforms.flipHorizontal(transforms.imageToCanvas(this.refs.image));

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.refs.selectionBox.style.display = "none";
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image flipped", { description: 'Flipped horizontally. Use "Save" to save changes.' });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    });
  }

  flipVertical() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const canvas = transforms.flipVertical(transforms.imageToCanvas(this.refs.image));

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.updateTransform();
        this.refs.selectionBox.style.display = "none";
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image flipped", { description: 'Flipped vertically. Use "Save" to save changes.' });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    });
  }

  resizeImage(newWidth, newHeight) {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    if (newWidth < 1 || newHeight < 1 || newWidth > 10000 || newHeight > 10000) {
      atom.notifications.addError("Invalid dimensions", { description: "Width and height must be between 1 and 10000 pixels." });
      return;
    }

    this.ensureInitialHistorySaved();
    this.showSpinner();

    const oldWidth = this.refs.image.naturalWidth;
    const oldHeight = this.refs.image.naturalHeight;
    const canvas = transforms.resizeImage(transforms.imageToCanvas(this.refs.image), newWidth, newHeight);

    transforms.canvasToBlob(canvas).then((blob) => {
      const url = URL.createObjectURL(blob);
      this.refs.image.src = url;
      this.refs.image.onload = () => {
        this.refs.image.onload = null;
        this.originalWidth = this.refs.image.naturalWidth;
        this.originalHeight = this.refs.image.naturalHeight;

        if (this.auto === true) this.zoomToFit();
        else if (this.auto === 1) this.zoomTo100();
        else this.updateTransform();

        this.refs.selectionBox.style.display = "none";
        this.emitter.emit("did-update");
        this.saveToHistory();
        this.hideSpinner();

        if (atom.config.get("image-editor.showSuccessMessages.transform")) {
          atom.notifications.addSuccess("Image resized", { description: `Resized from ${oldWidth}×${oldHeight} to ${newWidth}×${newHeight}. Use "Save" to save changes.` });
        }
      };
      this.refs.image.onerror = () => this.hideSpinner();
    });
  }

  async save() {
    if (!this.loaded) { atom.notifications.addError("No image to save"); return; }

    const currentPath = this.editor.getPath();
    if (!currentPath) return this.saveImage();

    try {
      this.isSaving = true;
      fileOps.saveImage(this.refs.image, currentPath,
        (path) => {
          this.historyManager.reset();
          setTimeout(() => { this.isSaving = false; }, 100);
          if (atom.config.get("image-editor.showSuccessMessages.save")) {
            atom.notifications.addSuccess("Image saved", { description: `Saved to ${path}` });
          }
        },
        (error) => {
          this.isSaving = false;
          atom.notifications.addError("Failed to save image", { description: error.message });
        }
      );
    } catch (error) {
      this.isSaving = false;
      atom.notifications.addError("Failed to save image", { description: error.message });
    }
  }

  async saveImage() {
    if (!this.loaded) { atom.notifications.addError("No image to save"); return; }

    fileOps.saveImageAs(this.refs.image, this.editor.getPath(),
      (path) => {
        if (atom.config.get("image-editor.showSuccessMessages.save")) {
          atom.notifications.addSuccess("Image saved", { description: `Saved to ${path}` });
        }
      },
      (error) => {
        atom.notifications.addError("Failed to save image", { description: error.message });
      }
    );
  }

  editInPaint() {
    const itemPath = this.editor.getPath();
    if (!itemPath) { atom.notifications.addError("No file path available"); return; }

    const supported = fileOps.editInPaint(itemPath, (error) => {
      atom.notifications.addError("Failed to open Paint", { description: error.message });
    });

    if (!supported) {
      atom.notifications.addWarning("Unsupported format for Paint");
    }
  }

  moveFile() {
    const currentPath = this.editor.getPath();
    if (!currentPath) { atom.notifications.addError("No file path available"); return; }

    try {
      fileOps.showMoveDialog(currentPath, (newPath) => atom.workspace.open(newPath), null, this.element);
    } catch (error) {
      atom.notifications.addError("Failed to open move dialog", { description: error.message });
    }
  }

  duplicateFile() {
    const currentPath = this.editor.getPath();
    if (!currentPath) { atom.notifications.addError("No file path available"); return; }

    try {
      fileOps.showDuplicateDialog(currentPath, null, null, this.element);
    } catch (error) {
      atom.notifications.addError("Failed to open duplicate dialog", { description: error.message });
    }
  }

  copySelectionToClipboard() {
    if (!this.refs.selectionBox || this.refs.selectionBox.style.display === "none") {
      atom.notifications.addWarning("No selection", { description: "Please create a selection first by dragging with the left mouse button." });
      return;
    }
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const area = this.getSelectionArea();
    if (!area || area.width === 0 || area.height === 0) {
      atom.notifications.addWarning("Invalid selection", { description: "Selection has no area." });
      return;
    }

    selection.copyToClipboard(
      this.refs.image,
      area.left, area.top, area.width, area.height,
      () => {
        if (atom.config.get("image-editor.showSuccessMessages.clipboard")) {
          atom.notifications.addSuccess("Selection copied", { description: "Selection copied to clipboard." });
        }
      },
      (error) => atom.notifications.addError("Failed to copy", { description: error.message })
    );
  }

  autoSelect(borderPercent = 0) {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const tolerance = atom.config.get("image-editor.autoSelectTolerance") || 30;
    const result = selection.autoSelectContent(this.refs.image, tolerance, borderPercent);

    if (!result.success) {
      if (result.reason === "no-content") {
        atom.notifications.addWarning("No content detected", { description: "Could not detect content boundaries. Try adjusting the tolerance in settings." });
      } else if (result.reason === "entire-image") {
        atom.notifications.addInfo("Entire image is content", { description: "No background detected. The entire image appears to be content." });
      }
      return;
    }

    this.selectionStartImg = result.start;
    this.selectionEndImg = result.end;
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    if (atom.config.get("image-editor.showSuccessMessages.selection")) {
      const borderText = borderPercent > 0 ? ` with ${borderPercent}% border` : "";
      atom.notifications.addSuccess(`Auto-selection complete${borderText}`, { description: `Selected ${result.width}x${result.height} px area.` });
    }
  }

  selectAll() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    this.selectionStartImg = { x: 0, y: 0 };
    this.selectionEndImg = { x: this.refs.image.naturalWidth - 1, y: this.refs.image.naturalHeight - 1 };
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    if (atom.config.get("image-editor.showSuccessMessages.selection")) {
      atom.notifications.addSuccess("Selected entire image", { description: `Selected ${this.refs.image.naturalWidth}×${this.refs.image.naturalHeight} px.` });
    }
  }

  selectVisibleArea() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const result = selection.getVisibleArea(
      this.refs.imageContainer.offsetWidth,
      this.refs.imageContainer.offsetHeight,
      this.translateX, this.translateY, this.zoom,
      this.refs.image.naturalWidth,
      this.refs.image.naturalHeight
    );

    if (!result) {
      atom.notifications.addWarning("No visible area", { description: "Image is not visible in the current viewport." });
      return;
    }

    this.selectionStartImg = result.start;
    this.selectionEndImg = result.end;
    this.setSelectionVisibility(true);
    this.updateSelectionBox();

    if (atom.config.get("image-editor.showSuccessMessages.selection")) {
      atom.notifications.addSuccess("Selected visible area", { description: `Selected ${result.width}×${result.height} px.` });
    }
  }

  saveToHistory() {
    if (!this.loaded) return;

    const canvas = this.getPooledCanvas(this.refs.image.naturalWidth, this.refs.image.naturalHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(this.refs.image, 0, 0);

    this.historyManager.saveStateWithCanvas(canvas, {
      translateX: this.translateX,
      translateY: this.translateY,
      zoom: this.zoom,
      auto: this.auto,
    }, this.imageSize);

    this.returnCanvasToPool(canvas);
  }

  isModified() {
    return this.historyManager.isModified();
  }

  undo() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    if (!this.historyManager.canUndo()) {
      atom.notifications.addWarning("Nothing to undo", { description: "Already at the oldest change." });
      return;
    }

    const state = this.historyManager.undo();
    this.loadFromHistory(state);

    if (atom.config.get("image-editor.showSuccessMessages.history")) {
      const pos = this.historyManager.getPosition();
      atom.notifications.addSuccess("Undo", { description: `Reverted to previous state (${pos.current}/${pos.total}).` });
    }
  }

  redo() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    if (!this.historyManager.canRedo()) {
      atom.notifications.addWarning("Nothing to redo", { description: "Already at the newest change." });
      return;
    }

    const state = this.historyManager.redo();
    this.loadFromHistory(state);

    if (atom.config.get("image-editor.showSuccessMessages.history")) {
      const pos = this.historyManager.getPosition();
      atom.notifications.addSuccess("Redo", { description: `Restored to next state (${pos.current}/${pos.total}).` });
    }
  }

  loadFromHistory(historyEntry) {
    if (!historyEntry) return;

    this.showSpinner();

    const prevWidth = this.refs.image.naturalWidth;
    const prevHeight = this.refs.image.naturalHeight;
    const dataUrl = this.historyManager.getDataUrl(historyEntry);

    const img = new Image();
    img.onload = () => {
      this.refs.image.src = dataUrl;
      this.originalHeight = img.naturalHeight;
      this.originalWidth = img.naturalWidth;

      if (this.auto === true) {
        this.zoomToFit();
      } else if (this.auto === 1) {
        this.zoomTo100();
      } else {
        if (typeof historyEntry !== "string" && (this.originalWidth !== prevWidth || this.originalHeight !== prevHeight)) {
          this.zoom = historyEntry.zoom;
          this.translateX = historyEntry.translateX;
          this.translateY = historyEntry.translateY;
        }
        this._applyTransform();
      }

      this.setSelectionVisibility(false);
      this.emitter.emit("did-update");
      this.hideSpinner();
    };
    img.onerror = () => this.hideSpinner();
    img.src = dataUrl;
  }

  showResizeDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const currentWidth = this.refs.image.naturalWidth;
    const currentHeight = this.refs.image.naturalHeight;
    const aspectRatio = currentWidth / currentHeight;

    const backdrop = dialogs.createDialogBackdrop();
    const { dialogElement, cleanup: dialogCleanup } = dialogs.createDraggableDialog("Resize Image");

    const infoElement = dialogs.createSelectionInfo(`Current size: ${currentWidth} × ${currentHeight} px`);
    dialogElement.appendChild(infoElement);

    const { container: widthContainer, input: widthInput } = dialogs.createNumberInput({ label: "Width (px)", default: currentWidth, min: 1, max: 10000 });
    const { container: heightContainer, input: heightInput } = dialogs.createNumberInput({ label: "Height (px)", default: currentHeight, min: 1, max: 10000 });
    dialogElement.appendChild(widthContainer);
    dialogElement.appendChild(heightContainer);

    const { container: lockContainer, checkbox: lockCheckbox } = dialogs.createCheckbox("lock-aspect-ratio", "Lock aspect ratio", true);
    dialogElement.appendChild(lockContainer);

    const percentButtons = dialogs.createQuickButtons([25, 50, 75, 100, 150, 200], (percent) => {
      widthInput.value = Math.round(currentWidth * (percent / 100));
      heightInput.value = Math.round(currentHeight * (percent / 100));
    }, (v) => `${v}%`);
    dialogElement.appendChild(percentButtons);

    let isUpdating = false;
    widthInput.addEventListener("input", () => {
      if (lockCheckbox.checked && !isUpdating) {
        isUpdating = true;
        heightInput.value = Math.round((parseInt(widthInput.value) || 1) / aspectRatio);
        isUpdating = false;
      }
    });
    heightInput.addEventListener("input", () => {
      if (lockCheckbox.checked && !isUpdating) {
        isUpdating = true;
        widthInput.value = Math.round((parseInt(heightInput.value) || 1) * aspectRatio);
        isUpdating = false;
      }
    });

    const { buttonContainer, cancelButton, applyButton } = dialogs.createButtonContainer("Cancel", "Resize");

    const cleanup = () => {
      dialogCleanup();
      document.removeEventListener("keydown", escapeHandler);
      if (document.body.contains(backdrop)) document.body.removeChild(backdrop);
    };

    cancelButton.addEventListener("click", cleanup);
    applyButton.addEventListener("click", () => {
      const newWidth = parseInt(widthInput.value) || currentWidth;
      const newHeight = parseInt(heightInput.value) || currentHeight;
      if (newWidth !== currentWidth || newHeight !== currentHeight) {
        this.resizeImage(newWidth, newHeight);
      }
      cleanup();
    });

    dialogElement.appendChild(buttonContainer);
    backdrop.appendChild(dialogElement);
    document.body.appendChild(backdrop);

    const escapeHandler = (e) => { if (e.key === "Escape") cleanup(); };
    document.addEventListener("keydown", escapeHandler);

    widthInput.focus();
    widthInput.select();
  }

  showFreeRotateDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const originalSrc = this.refs.image.src;
    const originalWidth = this.originalWidth;
    const originalHeight = this.originalHeight;
    const originalZoom = this.zoom;
    const originalTranslateX = this.translateX;
    const originalTranslateY = this.translateY;
    const originalAuto = this.auto;

    const backdrop = dialogs.createDialogBackdrop();
    const { dialogElement, cleanup: dialogCleanup } = dialogs.createDraggableDialog("Free Rotate");

    const { container: sliderContainer, slider: angleSlider, valueLabel } = dialogs.createSliderControl({
      label: "Angle (degrees)", min: -180, max: 180, default: 0, step: 0.5
    });
    dialogElement.appendChild(sliderContainer);

    const quickButtons = dialogs.createQuickButtons([-45, -30, -15, 0, 15, 30, 45], (angle) => {
      angleSlider.value = angle;
      valueLabel.textContent = `${angle}°`;
      schedulePreview();
    }, (v) => `${v}°`);
    dialogElement.appendChild(quickButtons);

    const { container: expandContainer, checkbox: expandCheckbox } = dialogs.createCheckbox("expand-canvas", "Expand canvas to fit rotated image", true);
    expandCheckbox.addEventListener("change", schedulePreview);
    dialogElement.appendChild(expandContainer);

    const { container: autoPreviewContainer, checkbox: autoPreviewCheckbox } = dialogs.createCheckbox("auto-preview", "Auto preview", false);
    dialogElement.appendChild(autoPreviewContainer);

    let previewTimeout = null;
    const schedulePreview = () => {
      if (!autoPreviewCheckbox.checked) return;
      if (previewTimeout) clearTimeout(previewTimeout);
      previewTimeout = setTimeout(() => this.applyRotatePreview(originalSrc, originalWidth, originalHeight, parseFloat(angleSlider.value), expandCheckbox.checked), 150);
    };

    angleSlider.addEventListener("input", () => {
      valueLabel.textContent = `${angleSlider.value}°`;
      schedulePreview();
    });

    autoPreviewCheckbox.addEventListener("change", () => {
      if (autoPreviewCheckbox.checked) {
        schedulePreview();
      } else {
        if (previewTimeout) clearTimeout(previewTimeout);
        this.restoreOriginalImage(originalSrc, originalWidth, originalHeight, originalZoom, originalTranslateX, originalTranslateY, originalAuto);
      }
    });

    const restoreOriginal = () => {
      if (previewTimeout) clearTimeout(previewTimeout);
      this.restoreOriginalImage(originalSrc, originalWidth, originalHeight, originalZoom, originalTranslateX, originalTranslateY, originalAuto);
    };

    const { buttonContainer, cancelButton, applyButton } = dialogs.createButtonContainer("Cancel", "Rotate");

    const cleanup = () => {
      dialogCleanup();
      document.removeEventListener("keydown", escapeHandler);
      if (document.body.contains(backdrop)) document.body.removeChild(backdrop);
    };

    cancelButton.addEventListener("click", () => { restoreOriginal(); cleanup(); });
    applyButton.addEventListener("click", () => {
      const angle = parseFloat(angleSlider.value);
      if (angle === 0) { restoreOriginal(); cleanup(); return; }
      restoreOriginal();
      this.freeRotate(angle, expandCheckbox.checked);
      cleanup();
    });

    dialogElement.appendChild(buttonContainer);
    backdrop.appendChild(dialogElement);
    document.body.appendChild(backdrop);

    const escapeHandler = (e) => { if (e.key === "Escape") { restoreOriginal(); cleanup(); } };
    document.addEventListener("keydown", escapeHandler);

    angleSlider.focus();
  }

  applyRotatePreview(originalSrc, originalWidth, originalHeight, angle, expand) {
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = transforms.freeRotateImage(transforms.imageToCanvas(tempImg), angle, expand);
      transforms.canvasToBlob(canvas).then((blob) => {
        const url = URL.createObjectURL(blob);
        this.refs.image.src = url;
        this.refs.image.onload = () => {
          this.refs.image.onload = null;
          this.originalWidth = canvas.width;
          this.originalHeight = canvas.height;
          if (this.auto === true) this.zoomToFit();
          else if (this.auto === 1) this.zoomTo100();
          else this.updateTransform();
          this.emitter.emit("did-update");
        };
      });
    };
    tempImg.src = originalSrc;
  }

  restoreOriginalImage(originalSrc, originalWidth, originalHeight, originalZoom, originalTranslateX, originalTranslateY, originalAuto) {
    this.refs.image.src = originalSrc;
    this.originalWidth = originalWidth;
    this.originalHeight = originalHeight;
    this.zoom = originalZoom;
    this.translateX = originalTranslateX;
    this.translateY = originalTranslateY;
    this.auto = originalAuto;
    if (this.auto === true) this.zoomToFit();
    else if (this.auto === 1) this.zoomTo100();
    else this._applyTransform();
    this.emitter.emit("did-update");
  }

  showBrightnessContrastDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Brightness & Contrast", [
      { label: "Brightness", min: -100, max: 100, default: 0, step: 1 },
      { label: "Contrast", min: -100, max: 100, default: 0, step: 1 },
    ], () => this.getSelectionArea(), (values) => this.applyBrightnessContrast(values[0], values[1]), this.emitter);
  }

  showSaturationDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Saturation", [
      { label: "Saturation", min: -100, max: 100, default: 0, step: 1 },
    ], () => this.getSelectionArea(), (values) => this.applySaturation(values[0]), this.emitter);
  }

  showHueShiftDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Hue Shift", [
      { label: "Hue", min: 0, max: 360, default: 0, step: 1 },
    ], () => this.getSelectionArea(), (values) => this.applyHueShift(values[0]), this.emitter);
  }

  showPosterizeDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Posterize", [
      { label: "Levels", min: 2, max: 32, default: 8, step: 1 },
    ], () => this.getSelectionArea(), (values) => this.applyPosterize(values[0]), this.emitter);
  }

  showBlurDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Blur", [
      { label: "Radius", min: 1, max: 50, default: 12, step: 1 },
    ], () => this.getSelectionArea(), (values) => this.blurImage(values[0]), this.emitter);
  }

  showSharpenDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }
    dialogs.showAdjustmentDialog("Sharpen", [
      { label: "Strength", min: 0.1, max: 3.0, default: 1.0, step: 0.1 },
    ], () => this.getSelectionArea(), (values) => this.sharpenImage(values[0]), this.emitter);
  }

  showPropertiesDialog() {
    if (!this.loaded) { atom.notifications.addError("Image not loaded"); return; }

    const currentPath = this.editor.getPath();
    if (!currentPath) { atom.notifications.addError("No file path available"); return; }

    const stats = fileOps.getFileStats(currentPath);
    if (!stats) { atom.notifications.addError("Cannot read file stats"); return; }

    const backdrop = dialogs.createDialogBackdrop();
    const dialogElement = document.createElement("div");
    dialogElement.className = "image-editor-properties-dialog";

    const titleElement = document.createElement("h3");
    titleElement.className = "dialog-title";
    titleElement.textContent = "Image Properties";
    dialogElement.appendChild(titleElement);

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

    const width = this.refs.image.naturalWidth;
    const height = this.refs.image.naturalHeight;
    const ext = path.extname(currentPath).toLowerCase();
    const formatMap = { ".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".gif": "GIF", ".bmp": "BMP", ".webp": "WebP", ".svg": "SVG" };

    addRow("File name", path.basename(currentPath));
    addRow("Folder", path.dirname(currentPath));
    addRow("Format", formatMap[ext] || ext.toUpperCase());
    addRow("Dimensions", `${width} × ${height} pixels (${((width * height) / 1000000).toFixed(2)} MP)`);
    addRow("Disk size", fileOps.formatBytes(stats.size));
    addRow("Memory size", fileOps.formatBytes(width * height * 4));
    addRow("Modified", fileOps.formatDate(stats.mtime));
    addRow("Created", fileOps.formatDate(stats.birthtime));

    const posInfo = this.navigator.getPositionInfo(currentPath);
    if (posInfo) addRow("Position in folder", posInfo);

    if (this.historyManager.length > 0) {
      const pos = this.historyManager.getPosition();
      addRow("History", `${pos.current} / ${pos.total} states`);
    }

    dialogElement.appendChild(table);

    const { buttonContainer, applyButton } = dialogs.createButtonContainer("", "Close");
    applyButton.className = "btn btn-primary";
    buttonContainer.innerHTML = "";
    buttonContainer.appendChild(applyButton);
    buttonContainer.style.marginTop = "15px";

    const cleanup = () => {
      document.removeEventListener("keydown", escapeHandler);
      if (document.body.contains(backdrop)) document.body.removeChild(backdrop);
    };

    applyButton.addEventListener("click", cleanup);
    dialogElement.appendChild(buttonContainer);
    backdrop.appendChild(dialogElement);
    document.body.appendChild(backdrop);

    const escapeHandler = (e) => { if (e.key === "Escape") cleanup(); };
    document.addEventListener("keydown", escapeHandler);

    applyButton.focus();
  }
};
