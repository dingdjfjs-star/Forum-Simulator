import { supabase, IMAGE_BUCKET } from '../lib/supabase';

/** 读取本地文件为 Image 对象 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

/**
 * 浏览器端压缩：最长边限制 + 转 webp。
 * 一张 3MB 的手机照片通常能压到 200KB 左右，省空间也省流量。
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.82
): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  );
  if (!blob) return file;
  // 原图本来就很小，压缩反而变大 → 用原图
  if (blob.size >= file.size && file.size < 400 * 1024) return file;
  return blob;
}

/** 上传图片，返回数据库里保存的相对路径 */
export async function uploadImage(file: File): Promise<string> {
  const blob = await compressImage(file);
  const isWebp = blob.type === 'image/webp';
  const rawExt = (file.name.split('.').pop() || '').toLowerCase();
  const ext = isWebp ? 'webp' : /^(png|gif|jpe?g|webp)$/.test(rawExt) ? rawExt : 'jpg';
  const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(error.message || '图片上传失败');
  return path;
}

/** 校验用户选择的文件 */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return '只能上传图片文件';
  if (file.size > 8 * 1024 * 1024) return '图片太大（上限 8MB）';
  return null;
}
