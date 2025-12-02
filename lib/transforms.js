/**
 * Image transformation module
 * Contains rotate, flip, resize, and crop operations
 */

// Rotate image by degrees (90, 180, 270)
function rotateImage(sourceCanvas, degrees) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // For 90 or 270 degree rotations, swap width and height
  const isOrthogonal = Math.abs(degrees) === 90 || Math.abs(degrees) === 270;
  if (isOrthogonal) {
    canvas.width = sourceCanvas.height;
    canvas.height = sourceCanvas.width;
  } else {
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
  }

  // Save current state
  ctx.save();

  // Move to center, rotate, then move back
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.translate(-sourceCanvas.width / 2, -sourceCanvas.height / 2);

  // Draw the image
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  return canvas;
}

// Free rotate image by arbitrary degrees
function freeRotateImage(sourceCanvas, degrees, expandCanvas = true) {
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

  // Create canvas for rotation
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // Use high-quality image scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Move to center, rotate, then draw
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(sourceCanvas, -originalWidth / 2, -originalHeight / 2);

  return canvas;
}

// Flip image horizontally
function flipHorizontal(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(sourceCanvas, -canvas.width, 0);
  ctx.restore();

  return canvas;
}

// Flip image vertically
function flipVertical(sourceCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");

  ctx.save();
  ctx.scale(1, -1);
  ctx.drawImage(sourceCanvas, 0, -canvas.height);
  ctx.restore();

  return canvas;
}

// Resize image to new dimensions
function resizeImage(sourceCanvas, newWidth, newHeight) {
  const canvas = document.createElement("canvas");
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
function cropImage(sourceCanvas, left, top, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Draw the cropped portion
  ctx.drawImage(
    sourceCanvas,
    left, top, width, height, // Source rectangle
    0, 0, width, height // Destination rectangle
  );

  return canvas;
}

// Create canvas from image element
function imageToCanvas(imageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = imageElement.naturalWidth;
  canvas.height = imageElement.naturalHeight;
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
