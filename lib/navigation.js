/**
 * Image navigation module
 * Contains file list management, navigation, and preloading
 */

const fs = require("fs");
const path = require("path");

class ImageNavigator {
  constructor(options = {}) {
    this.extensions = options.extensions || [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg"];
    this.preloadCache = new Map();
    this.fileListCache = {
      directory: null,
      files: [],
      currentIndex: -1,
    };
    this.treeView = options.treeView || null;
  }

  // Set tree-view reference for faster file listing
  setTreeView(treeView) {
    this.treeView = treeView;
  }

  // Get sorted list of image files in directory
  async getFileList(currentPath) {
    const directory = path.dirname(currentPath);

    // Check if cache is valid for the directory
    if (
      this.fileListCache.directory === directory &&
      this.fileListCache.files.length > 0
    ) {
      // Update current index based on actual current file
      this.fileListCache.currentIndex = this.fileListCache.files.findIndex(
        (f) => path.normalize(f).toLowerCase() === path.normalize(currentPath).toLowerCase()
      );
      return this.fileListCache;
    }

    // Try to get files from tree-view first (much faster!)
    let files = [];

    if (this.treeView && this.treeView.entryForPath) {
      try {
        const dirEntry = this.treeView.entryForPath(directory);
        if (dirEntry && dirEntry.children) {
          files = Array.from(dirEntry.children)
            .filter((entry) => {
              if (!entry.file || !entry.path) return false;
              const ext = path.extname(entry.path).toLowerCase();
              return this.extensions.includes(ext);
            })
            .map((entry) => entry.path)
            .sort((a, b) =>
              path.basename(a).localeCompare(path.basename(b), undefined, {
                numeric: true,
                sensitivity: "base",
              })
            );
        }
      } catch (e) {
        // Fall through to filesystem
      }
    }

    // Fallback to filesystem if tree-view didn't work
    if (files.length === 0) {
      try {
        const entries = await fs.promises.readdir(directory);
        files = entries
          .filter((file) => this.extensions.includes(path.extname(file).toLowerCase()))
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
        };
      }
    }

    // Update cache
    this.fileListCache.directory = directory;
    this.fileListCache.files = files;
    this.fileListCache.currentIndex = files.findIndex(
      (f) => path.normalize(f).toLowerCase() === path.normalize(currentPath).toLowerCase()
    );

    return this.fileListCache;
  }

  // Invalidate file list cache
  invalidateCache() {
    this.fileListCache.directory = null;
    this.fileListCache.files = [];
    this.fileListCache.currentIndex = -1;
  }

  // Get adjacent image path
  async getAdjacentImage(currentPath, direction) {
    const fileList = await this.getFileList(currentPath);

    if (fileList.files.length === 0 || fileList.currentIndex === -1) {
      return null;
    }

    let newIndex = fileList.currentIndex + direction;
    const cycle = atom.config.get("image-editor.scrollCycle") !== false;

    if (newIndex < 0) {
      newIndex = cycle ? fileList.files.length - 1 : null;
    } else if (newIndex >= fileList.files.length) {
      newIndex = cycle ? 0 : null;
    }

    return newIndex !== null ? fileList.files[newIndex] : null;
  }

  // Get next image path
  async getNextImage(currentPath) {
    return this.getAdjacentImage(currentPath, 1);
  }

  // Get previous image path
  async getPreviousImage(currentPath) {
    return this.getAdjacentImage(currentPath, -1);
  }

  // Get first image path
  async getFirstImage(currentPath) {
    const fileList = await this.getFileList(currentPath);
    return fileList.files.length > 0 ? fileList.files[0] : null;
  }

  // Get last image path
  async getLastImage(currentPath) {
    const fileList = await this.getFileList(currentPath);
    return fileList.files.length > 0 ? fileList.files[fileList.files.length - 1] : null;
  }

  // Check if at start of file list
  async isAtStart(currentPath) {
    const fileList = await this.getFileList(currentPath);
    return fileList.files.length > 0 && fileList.currentIndex === 0;
  }

  // Check if at end of file list
  async isAtEnd(currentPath) {
    const fileList = await this.getFileList(currentPath);
    return fileList.files.length > 0 && fileList.currentIndex === fileList.files.length - 1;
  }

  // Encode file path for URL
  encodeFilePath(filePath) {
    return `file://${encodeURI(filePath.replace(/\\/g, "/"))
      .replace(/#/g, "%23")
      .replace(/\?/g, "%3F")}`;
  }

  // Preload image with zoom calculation
  preloadImage(imagePath, containerWidth, containerHeight, currentZoom, autoMode, zoomLimit) {
    if (this.preloadCache.has(imagePath)) {
      return; // Already cached
    }

    try {
      const img = new Image();
      const encodedPath = this.encodeFilePath(imagePath);

      img.onload = () => {
        const newWidth = img.naturalWidth;
        const newHeight = img.naturalHeight;
        let zoom, translateX, translateY;

        if (autoMode) {
          // Zoom to fit mode (matches view.js zoomToFit behavior)
          zoom = Math.min(containerWidth / newWidth, containerHeight / newHeight);
          if (zoomLimit) zoom = Math.min(zoom, zoomLimit);
        } else {
          // Manual zoom - keep current zoom
          zoom = currentZoom;
        }

        const imageWidth = newWidth * zoom;
        const imageHeight = newHeight * zoom;
        translateX = (containerWidth - imageWidth) / 2;
        translateY = (containerHeight - imageHeight) / 2;

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

  // Preload adjacent images
  async preloadAdjacentImages(currentPath, containerWidth, containerHeight, currentZoom, autoMode, zoomLimit) {
    const nextPath = await this.getNextImage(currentPath);
    const prevPath = await this.getPreviousImage(currentPath);

    if (nextPath && !this.preloadCache.has(nextPath)) {
      this.preloadImage(nextPath, containerWidth, containerHeight, currentZoom, autoMode, zoomLimit);
    }

    if (prevPath && !this.preloadCache.has(prevPath)) {
      this.preloadImage(prevPath, containerWidth, containerHeight, currentZoom, autoMode, zoomLimit);
    }

    // Clean up cache - keep only adjacent images
    const keepPaths = new Set([nextPath, prevPath].filter(Boolean));
    for (const [cachedPath, data] of this.preloadCache.entries()) {
      if (!keepPaths.has(cachedPath)) {
        if (data.img) {
          data.img.src = ""; // Release memory
        }
        this.preloadCache.delete(cachedPath);
      }
    }
  }

  // Get preloaded image data
  getPreloadedData(imagePath) {
    return this.preloadCache.get(imagePath);
  }

  // Check if image is preloaded and ready
  isPreloaded(imagePath) {
    const data = this.preloadCache.get(imagePath);
    return data && data.img && data.img.complete && data.img.naturalWidth > 0;
  }

  // Clear all preload cache
  clearCache() {
    for (const [, data] of this.preloadCache.entries()) {
      if (data.img) {
        data.img.src = "";
      }
    }
    this.preloadCache.clear();
  }

  // Get position info string
  async getPositionInfo(currentPath) {
    const fileList = await this.getFileList(currentPath);
    if (fileList.currentIndex >= 0 && fileList.files.length > 0) {
      return `${fileList.currentIndex + 1} / ${fileList.files.length}`;
    }
    return null;
  }
}

module.exports = ImageNavigator;
