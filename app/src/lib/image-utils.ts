
/**
 * Utilitários para processamento de imagens no frontend.
 * Funciona tanto na Web quanto no Desktop (Tauri).
 */

export interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0.0 a 1.0
}

const DEFAULT_RESIZE_OPTIONS: ResizeOptions = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
};

/**
 * Redimensiona uma imagem (File) para as dimensões especificadas, mantendo a proporção.
 * Retorna um novo File (JPEG) otimizado.
 */
export async function resizeImage(file: File, options: Partial<ResizeOptions> = {}): Promise<File> {
  const config = { ...DEFAULT_RESIZE_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Calcula novas dimensões mantendo proporção
      if (width > config.maxWidth || height > config.maxHeight) {
        const ratio = Math.min(config.maxWidth / width, config.maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível criar contexto 2D do canvas'));
        return;
      }

      // Desenha imagem redimensionada
      ctx.drawImage(img, 0, 0, width, height);

      // Converte para Blob/File
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao converter canvas para blob'));
            return;
          }
          
          // Cria novo arquivo com mesmo nome (mas extensão jpg)
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const resizedFile = new File([blob], newName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(resizedFile);
        },
        'image/jpeg',
        config.quality
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
