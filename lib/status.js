const { CompositeDisposable } = require("atom");
const ImageEditor = require("./editor");
const ImageEditorView = require("./view");
const bytes = require("bytes");

module.exports = class ImageEditorStatusView {
  constructor(statusBar) {
    this.statusBar = statusBar;
    this.disposables = new CompositeDisposable();

    this.element = document.createElement("div");
    this.element.classList.add("status-image", "inline-block");

    this.imageSizeStatus = document.createElement("span");
    this.imageSizeStatus.classList.add("image-size");
    this.element.appendChild(this.imageSizeStatus);

    this.mousePositionStatus = document.createElement("span");
    this.mousePositionStatus.classList.add("mouse-position");
    this.mousePositionStatus.style.marginLeft = "10px";
    this.element.appendChild(this.mousePositionStatus);

    this.attach();

    this.disposables.add(
      atom.workspace.getCenter().onDidChangeActivePaneItem(() => {
        this.updateImageSize();
      }),
    );
  }

  attach() {
    this.statusBarTile = this.statusBar.addLeftTile({ item: this });
    this.updateImageSize();
  }

  destroy() {
    this.statusBarTile.destroy();
    this.disposables.dispose();
  }

  getImageSize({ originalHeight, originalWidth, imageSize }) {
    this.imageSizeStatus.textContent = `${originalWidth}x${originalHeight} ${bytes(imageSize)}`;
    this.imageSizeStatus.style.display = "";
  }

  updateMousePosition(x, y) {
    if (x !== null && y !== null) {
      this.mousePositionStatus.textContent = `(${x}, ${y})`;
      this.mousePositionStatus.style.display = "";
    } else {
      this.mousePositionStatus.style.display = "none";
    }
  }

  updateImageSize() {
    if (this.imageLoadCompositeDisposable) {
      this.imageLoadCompositeDisposable.dispose();
    }

    const editor = atom.workspace.getCenter().getActivePaneItem();
    if (editor instanceof ImageEditor && editor.view instanceof ImageEditorView) {
      this.editorView = editor.view;
      if (this.editorView.loaded) {
        this.getImageSize(this.editorView);
      }

      this.imageLoadCompositeDisposable = new CompositeDisposable();
      const callback = () => {
        if (editor === atom.workspace.getCenter().getActivePaneItem()) {
          this.getImageSize(this.editorView);
        }
      };
      this.imageLoadCompositeDisposable.add(this.editorView.onDidLoad(callback));
      this.imageLoadCompositeDisposable.add(this.editorView.onDidUpdate(callback));

      // Set up mouse position tracking - using ...args to capture all arguments
      this.imageLoadCompositeDisposable.add(
        this.editorView.onMousePosition((args) => {
          if (editor === atom.workspace.getCenter().getActivePaneItem()) {
            this.updateMousePosition(args.imgX, args.imgY);
          }
        }),
      );
    } else {
      this.imageSizeStatus.style.display = "none";
      this.mousePositionStatus.style.display = "none";
    }
  }
};
