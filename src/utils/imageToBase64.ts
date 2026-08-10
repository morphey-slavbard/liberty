/**
 * Converts an image URL or File object to a base64 string
 * @param input - Image URL string or File object
 * @returns Promise<string> - Base64 encoded image data
 */
export async function imageToBase64(input: string | File): Promise<string> {
  if (input instanceof File) {
    return fileToBase64(input);
  } else {
    return urlToBase64(input);
  }
}

/**
 * Converts a File object to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('File size exceeds 10MB limit'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part (remove data:image/...; prefix)
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Converts an image URL to base64 by fetching and converting
 */
async function urlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Check blob size (limit to 10MB)
    if (blob.size > 10 * 1024 * 1024) {
      throw new Error('Image size exceeds 10MB limit');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part (remove data:image/...; prefix)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => {
        reject(new Error('Failed to convert image to base64'));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error(`Image conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
