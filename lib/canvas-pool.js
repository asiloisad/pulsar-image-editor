/**
 * Canvas pooling module
 * Manages a pool of canvas elements for reuse to improve performance
 */

class CanvasPool {
  constructor(maxSize = 3) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  /**
   * Get a canvas from the pool or create a new one
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {HTMLCanvasElement}
   */
  getCanvas(width, height) {
    // Try to find a suitable canvas in the pool
    const canvasIndex = this.pool.findIndex(
      (c) => c.width >= width && c.height >= height && c.width < width * 1.5 && c.height < height * 1.5
    );

    if (canvasIndex !== -1) {
      const canvas = this.pool.splice(canvasIndex, 1)[0];
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    // Create a new canvas if none suitable in pool
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Return a canvas to the pool for reuse
   * @param {HTMLCanvasElement} canvas - Canvas to return
   */
  returnCanvas(canvas) {
    if (this.pool.length < this.maxSize) {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pool.push(canvas);
    } else {
      // Release memory if pool is full
      canvas.width = canvas.height = 0;
    }
  }

  /**
   * Clear all canvases in the pool
   */
  clear() {
    this.pool.forEach((canvas) => (canvas.width = canvas.height = 0));
    this.pool = [];
  }

  /**
   * Get current pool size
   * @returns {number}
   */
  get size() {
    return this.pool.length;
  }
}

module.exports = CanvasPool;
