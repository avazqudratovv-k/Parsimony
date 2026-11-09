// Phone photos are 3-12 MB. A receipt stays readable at 1600px, so shrink before uploading:
// faster on mobile data, and well under the server's 8 MiB limit.
const MAX_SIDE = 1600;

export async function prepareReceipt(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // Not decodable here (HEIC on some browsers, or no createImageBitmap): send the original and let the server decide.
  }
  return file;
}
