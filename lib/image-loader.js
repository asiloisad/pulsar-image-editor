/**
 * Image loading module
 * Handles optimized image loading with abort support
 */

class ImageLoader {
  constructor() {
    this.currentLoadController = null;
  }

  /**
   * Load image with optimization for large files
   * @param {HTMLImageElement} imageElement - Target image element
   * @param {string} imageUrl - Image URL to load
   * @param {number} imageSize - Image file size in bytes
   * @param {number} largeImageThreshold - Threshold for large images
   * @returns {Promise<{width: number, height: number}>}
   */
  async loadImage(imageElement, imageUrl, imageSize, largeImageThreshold) {
    // Cancel any ongoing load
    if (this.currentLoadController) {
      this.currentLoadController.cancelled = true;
    }

    this.currentLoadController = { cancelled: false };
    const currentLoad = this.currentLoadController;

    const isLargeImage = imageSize > largeImageThreshold;

    return new Promise((resolve, reject) => {
      imageElement.src = imageUrl;

      imageElement.onload = async () => {
        try {
          if (currentLoad.cancelled) {
            resolve({ cancelled: true });
            return;
          }

          // Async decode for large images
          if (isLargeImage && imageElement.decode) {
            try {
              await imageElement.decode();
            } catch (decodeError) {
              if (currentLoad.cancelled) {
                resolve({ cancelled: true });
                return;
              }
              console.warn(
                "Image decode failed, continuing without async decode:",
                decodeError.message,
              );
            }
          }

          if (currentLoad.cancelled) {
            resolve({ cancelled: true });
            return;
          }

          imageElement.onload = null;
          resolve({
            width: imageElement.naturalWidth,
            height: imageElement.naturalHeight,
            cancelled: false,
          });
        } catch (error) {
          reject(error);
        }
      };

      imageElement.onerror = () => {
        imageElement.onerror = null;
        if (currentLoad.cancelled) {
          resolve({ cancelled: true });
        } else {
          reject(new Error("Failed to load image"));
        }
      };
    });
  }

  /**
   * Load image from file path without flicker
   * @param {string} imagePath - Image file path
   * @param {Function} encodePathFn - Function to encode file path
   * @returns {Promise<{img: Image, encodedPath: string}>}
   */
  async loadImageFromPath(imagePath, encodePathFn) {
    return new Promise((resolve, reject) => {
      const encodedPath = `${encodePathFn(imagePath)}?time=${Date.now()}`;
      const tempImg = new Image();

      tempImg.onload = () => {
        resolve({ img: tempImg, encodedPath });
      };

      tempImg.onerror = () => {
        reject(new Error(`Failed to load ${imagePath}`));
      };

      tempImg.src = encodedPath;
    });
  }

  /**
   * Cancel current image load
   */
  cancelLoad() {
    if (this.currentLoadController) {
      this.currentLoadController.cancelled = true;
      this.currentLoadController = null;
    }
  }

  /**
   * Check if a load is in progress
   * @returns {boolean}
   */
  isLoading() {
    return this.currentLoadController !== null && !this.currentLoadController.cancelled;
  }
}

module.exports = ImageLoader;
