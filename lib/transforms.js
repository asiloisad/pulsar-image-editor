/**
 * Image transformation module
 * Contains rotate, flip, resize, and crop operations
 */

// Rotate image by degrees (90, 180, 270) - optimized for orthogonal rotations
function rotateImage(sourceCanvas, degrees, canvasPool = null) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const normalizedDegrees = ((degrees % 360) + 360) % 360;

  // Determine output dimensions
  const swapDimensions = normalizedDegrees === 90 || normalizedDegrees === 270;
  const width = swapDimensions ? sh : sw;
  const height = swapDimensions ? sw : sh;

  // Get canvas from pool or create new one
  const canvas = canvasPool
    ? canvasPool.getCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Use optimized direct transforms for orthogonal rotations
  switch (normalizedDegrees) {
    case 90:
      ctx.setTransform(0, 1, -1, 0, sh, 0);
      break;
    case 180:
      ctx.setTransform(-1, 0, 0, -1, sw, sh);
      break;
    case 270:
      ctx.setTransform(0, -1, 1, 0, 0, sw);
      break;
    default:
      ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

  return canvas;
}

// Free rotate image by arbitrary degrees
function freeRotateImage(sourceCanvas, degrees, expandCanvas = true, canvasPool = null) {
  const originalWidth = sourceCanvas.width;
  const originalHeight = sourceCanvas.height;
  const radians = (degrees * Math.PI) / 180;

  let canvasWidth, canvasHeight;

  if (expandCanvas) {
    // Calculate the bounding box of the rotated image
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    canvasWidth = Math.ceil(originalWidth * cos + originalHeight * sin);
    canvasHeight = Math.ceil(originalWidth * sin + originalHeight * cos);
  } else {
    // Keep original dimensions (will crop corners)
    canvasWidth = originalWidth;
    canvasHeight = originalHeight;
  }

  // Get canvas from pool or create new one
  const canvas = canvasPool
    ? canvasPool.getCanvas(canvasWidth, canvasHeight)
    : document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Use setTransform for better performance
  const cosR = Math.cos(radians);
  const sinR = Math.sin(radians);
  ctx.setTransform(cosR, sinR, -sinR, cosR, canvasWidth / 2, canvasHeight / 2);
  ctx.drawImage(sourceCanvas, -originalWidth / 2, -originalHeight / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

  return canvas;
}

// Flip image horizontally
function flipHorizontal(sourceCanvas, canvasPool = null) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const canvas = canvasPool
    ? canvasPool.getCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.setTransform(-1, 0, 0, 1, width, 0);
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas;
}

// Flip image vertically
function flipVertical(sourceCanvas, canvasPool = null) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const canvas = canvasPool
    ? canvasPool.getCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.setTransform(1, 0, 0, -1, 0, height);
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas;
}

// Resize image to new dimensions
function resizeImage(sourceCanvas, newWidth, newHeight, canvasPool = null) {
  const canvas = canvasPool
    ? canvasPool.getCanvas(newWidth, newHeight)
    : document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext("2d");

  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the resized image
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

  return canvas;
}

// Crop image to specified area
function cropImage(sourceCanvas, left, top, width, height, canvasPool = null) {
  const canvas = canvasPool
    ? canvasPool.getCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Draw the cropped portion
  ctx.drawImage(
    sourceCanvas,
    left,
    top,
    width,
    height, // Source rectangle
    0,
    0,
    width,
    height, // Destination rectangle
  );

  return canvas;
}

// Create canvas from image element
function imageToCanvas(imageElement, canvasPool = null) {
  const width = imageElement.naturalWidth;
  const height = imageElement.naturalHeight;
  const canvas = canvasPool
    ? canvasPool.getCanvas(width, height)
    : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageElement, 0, 0);
  return canvas;
}

// Convert canvas to blob (async)
function canvasToBlob(canvas, mimeType = "image/png") {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType);
  });
}

// Convert canvas to data URL
function canvasToDataURL(canvas, mimeType = "image/png", quality = 1.0) {
  return canvas.toDataURL(mimeType, quality);
}

module.exports = {
  rotateImage,
  freeRotateImage,
  flipHorizontal,
  flipVertical,
  resizeImage,
  cropImage,
  imageToCanvas,
  canvasToBlob,
  canvasToDataURL,
};
