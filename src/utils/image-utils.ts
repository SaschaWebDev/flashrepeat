const MAX_DIMENSION = 1080;
const MAX_SIZE_BYTES = 1_000_000; // 1MB
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.4;

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if exceeds max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG compression with decreasing quality until under 1MB
      let quality = INITIAL_QUALITY;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      while (dataUrl.length > MAX_SIZE_BYTES * 1.37 && quality > MIN_QUALITY) {
        // 1.37 accounts for base64 overhead (4/3 ratio)
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
