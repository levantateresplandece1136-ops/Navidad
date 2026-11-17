import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';
import { optimizeImageForUpload } from '../utils/imageOptimizer';

export async function uploadWishImage(uid: string, file: File): Promise<string> {
  const optimizedBlob = await optimizeImageForUpload(file, 1200);
  const ext = optimizedBlob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(storage, `wishes/${uid}/${fileName}`);

  try {
    await uploadBytes(storageRef, optimizedBlob, {
      contentType: optimizedBlob.type,
      cacheControl: 'public,max-age=31536000',
    });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Storage upload error:', error);
    throw new Error(
      'No se pudo subir la fotografía a Firebase Storage. Asegúrate de tener Firebase Storage activado y las reglas de storage.rules publicadas.'
    );
  }
}

export async function uploadAvatarImage(uid: string, file: File): Promise<string> {
  const optimizedBlob = await optimizeImageForUpload(file, 512);
  const ext = optimizedBlob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `avatar_${Date.now()}.${ext}`;
  const storageRef = ref(storage, `avatars/${uid}/${fileName}`);

  try {
    await uploadBytes(storageRef, optimizedBlob, {
      contentType: optimizedBlob.type,
      cacheControl: 'public,max-age=31536000',
    });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw new Error(
      'No se pudo actualizar tu foto de perfil en Firebase Storage. Verifica que Storage esté habilitado en Firebase Console.'
    );
  }
}

export async function deleteStorageImageByUrl(url?: string): Promise<void> {
  if (!url || !url.includes('firebasestorage')) return;
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    // Non-blocking cleanup if file was already removed
  }
}
