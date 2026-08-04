// public/js/utils.js

/** Rate-limit a function, always delivering the final call. */
export function throttle(fn, interval) {
  let lastRun = 0;
  let timer = null;
  let pending = null;

  return (...args) => {
    pending = args;
    const wait = interval - (Date.now() - lastRun);

    if (wait <= 0) {
      lastRun = Date.now();
      fn(...pending);
      pending = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        lastRun = Date.now();
        if (pending) fn(...pending);
        pending = null;
      }, wait);
    }
  };
}

export function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // May be needed if images are served from a different origin
    img.src = imageUrl;

    img.onload = function () {
      // Create a canvas to draw the image
      const canvas = document.createElement('canvas');
      canvas.width = 1; // Reduce size for performance
      canvas.height = 1;

      const ctx = canvas.getContext('2d');

      // Draw the image scaled down to 1x1 pixel
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get the pixel data from the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Extract the color from the single pixel
      const [r, g, b] = data;

      // Format the color as an RGB string
      const dominantColor = `rgb(${r},${g},${b})`;

      resolve(dominantColor);
    };

    img.onerror = function () {
      reject('Image loading error');
    };
  });
}
