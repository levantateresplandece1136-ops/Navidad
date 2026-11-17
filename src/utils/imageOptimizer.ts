const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB input cap before compression
const TARGET_MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

export async function optimizeImageForUpload(file: File, maxDimension = TARGET_MAX_DIMENSION): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecciona un archivo de imagen válido (JPG, PNG o WebP).');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('La imagen pesa demasiado (máximo 8 MB). Elige una fotografía más ligera.');
  }

  const imageBitmap = await loadImageElement(file);
  const { width, height } = calculateTargetSize(imageBitmap.width, imageBitmap.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo optimizar la imagen seleccionada.'));
          return;
        }
        resolve(blob);
      },
      outputType,
      JPEG_QUALITY
    );
  });
}

function calculateTargetSize(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) {
    return { width, height };
  }
  if (width >= height) {
    return {
      width: maxDim,
      height: Math.round((height * maxDim) / width),
    };
  }
  return {
    width: Math.round((width * maxDim) / height),
    height: maxDim,
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No pudimos leer la imagen seleccionada.'));
    };
    img.src = url;
  });
}
