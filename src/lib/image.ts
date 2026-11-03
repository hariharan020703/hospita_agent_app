// Local image previews for uploaded documents. Nothing is sent anywhere: the picture is shrunk in the browser so a
// small copy can be kept with the record (and shown to the doctor as the source document).

export async function imagePreview(file: Blob, maxSize = 900, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || maxSize, image.naturalHeight || maxSize));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || maxSize) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || maxSize) * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is not available');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const isPdf = (file: File): boolean => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
