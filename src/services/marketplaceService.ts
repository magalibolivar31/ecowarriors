import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, storage } from '../firebase';
import { MarketplacePost } from '../types';
import { sanitizeText } from '../lib/utils';

const MARKETPLACE_COLLECTION = 'marketplace';
const MARKETPLACE_PAGE_SIZE = 50;

function normalizeMarketplaceType(value: unknown): 'doy' | 'recibo' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'doy' || normalized === 'recibo') return normalized;
  return null;
}

function normalizeMarketplaceStatus(
  value: unknown
): 'activa' | 'resuelta' | 'cerrada' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'activa' || normalized === 'disponible' || normalized === 'reservado') return 'activa';
  if (normalized === 'resuelta' || normalized === 'entregado/resuelto') return 'resuelta';
  if (normalized === 'cerrada' || normalized === 'vencido') return 'cerrada';
  return null;
}

function normalizeMarketplaceIsActive(value: unknown, status: 'activa' | 'resuelta' | 'cerrada' | null): boolean {
  if (typeof value === 'boolean') return value;
  if (status) return status === 'activa';
  return true;
}

function reportMarketplaceError(error: unknown, operation: OperationType, path: string): string {
  try {
    handleFirestoreError(error, operation, path);
  } catch (loggedError) {
    return loggedError instanceof Error ? loggedError.message : String(loggedError);
  }
  return error instanceof Error ? error.message : String(error);
}

function normalizeMarketplaceImagePayload(images: string[]): string[] {
  return images
    .filter((image): image is string => typeof image === 'string')
    .map((image) => image.trim())
    .filter(Boolean);
}

function normalizeMarketplaceImages(data: Record<string, unknown>): string[] {
  const directImages = Array.isArray(data.images) ? data.images : [];
  const fallbackImages = [data.imageUrl, data.image];
  const normalized = [...directImages, ...fallbackImages]
    .map((image) => {
      if (typeof image === 'string') return image.trim();
      if (image && typeof image === 'object') {
        const obj = image as Record<string, unknown>;
        if (typeof obj.url === 'string') return obj.url.trim();
        if (typeof obj.imageUrl === 'string') return obj.imageUrl.trim();
      }
      return '';
    })
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

async function resolveMarketplaceImageUrl(image: string): Promise<string | null> {
  if (!image) return null;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:image/')) {
    return image;
  }

  try {
    const normalizedPath = image.startsWith('/') ? image.slice(1) : image;
    return await getDownloadURL(ref(storage, normalizedPath));
  } catch {
    return null;
  }
}

async function uploadMarketplaceImage(image: string, uid: string): Promise<string | null> {
  if (!image || !image.startsWith('data:image/')) return null;
  const mimeTypeSeparatorIndex = image.indexOf(';');
  if (mimeTypeSeparatorIndex === -1) return null;
  const mimeType = image.slice('data:'.length, mimeTypeSeparatorIndex);
  const extension = mimeType.split('/')[1] || 'jpg';
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const imagePath = `marketplace/${uid}/${Date.now()}.${safeExtension}`;
  const storageRef = ref(storage, imagePath);
  await uploadString(storageRef, image, 'data_url');
  return getDownloadURL(storageRef);
}

export async function createMarketplacePost(
  type: 'doy' | 'recibo',
  title: string,
  content: string,
  tag: string,
  images: string[],
  contact: string
): Promise<string> {
  if (!auth.currentUser) throw new Error('User must be authenticated');

  const uid = auth.currentUser.uid;
  const userName = auth.currentUser.displayName || 'Usuario EcoWarrior';
  
  try {
    const normalizedType = normalizeMarketplaceType(type);
    if (!normalizedType) {
      throw new Error(`Invalid marketplace post type: "${String(type)}". Expected "doy" or "recibo".`);
    }

    const normalizedImages = normalizeMarketplaceImagePayload(images);
    const firstImage = normalizedImages[0] ?? '';
    const uploadedImageUrl = await uploadMarketplaceImage(firstImage, uid);
    const resolvedImageUrl = uploadedImageUrl ?? (await resolveMarketplaceImageUrl(firstImage));
    const status = 'activa' as const;
    const sanitizedTag = tag ? sanitizeText(tag) : 'otros';
    const postData = {
      uid,
      userId: uid,
      userName,
      type: normalizedType,
      title: sanitizeText(title),
      description: sanitizeText(content),
      content: sanitizeText(content),
      category: sanitizedTag,
      tag: sanitizedTag,
      images: resolvedImageUrl ? [resolvedImageUrl] : [],
      imageUrl: resolvedImageUrl ?? null,
      contact: contact ? sanitizeText(contact) : null,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: status === 'activa',
    };

    const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTION), postData);
    return docRef.id;
  } catch (error) {
    reportMarketplaceError(error, OperationType.CREATE, MARKETPLACE_COLLECTION);
    throw error;
  }
}

export async function updatePostStatus(
  postId: string, 
  status: 'activa' | 'resuelta' | 'cerrada'
): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const postRef = doc(db, MARKETPLACE_COLLECTION, postId);
    await updateDoc(postRef, {
      status,
      isActive: status === 'activa',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    reportMarketplaceError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

export function subscribeToMarketplace(
  callback: (posts: MarketplacePost[]) => void,
  onError?: (message: string) => void,
) {
  const q = query(
    collection(db, MARKETPLACE_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(MARKETPLACE_PAGE_SIZE),
  );
  let latestSnapshotRequest = 0;

  return onSnapshot(q, (snapshot) => {
    const requestId = ++latestSnapshotRequest;

    // --- Synchronous fast path ---
    // Build posts immediately using only already-resolved URLs (http/https/data:).
    // This lets the UI render without waiting for any async work.
    const rawPosts: MarketplacePost[] = snapshot.docs.map((snapshotDoc) => {
      const rawData = snapshotDoc.data() as Record<string, unknown>;
      const rawImages = normalizeMarketplaceImages(rawData);
      const normalizedType = normalizeMarketplaceType(rawData.type);
      const normalizedStatus = normalizeMarketplaceStatus(rawData.status);
      const normalizedIsActive = normalizeMarketplaceIsActive(rawData.isActive, normalizedStatus);

      const resolvedImages = rawImages.filter(
        (img) => img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/'),
      );

      return {
        id: snapshotDoc.id,
        ...rawData,
        ...(typeof rawData.description === 'string' ? { description: rawData.description } : {}),
        ...(typeof rawData.content === 'string' ? {} : (typeof rawData.description === 'string' ? { content: rawData.description } : {})),
        ...(typeof rawData.category === 'string' ? { category: rawData.category } : (typeof rawData.tag === 'string' ? { category: rawData.tag } : {})),
        ...(normalizedType ? { type: normalizedType } : {}),
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...((normalizedStatus || rawData.isActive === false || rawData.isActive === true)
          ? { isActive: normalizedIsActive }
          : {}),
        ...(rawImages.length > 0 ? { images: resolvedImages } : {}),
        ...(resolvedImages[0]
          ? { imageUrl: resolvedImages[0] }
          : (typeof rawData.imageUrl === 'string' ? { imageUrl: rawData.imageUrl } : {})),
      } as MarketplacePost;
    });

    // Deliver synchronously — no async delay
    callback(rawPosts);

    // --- Background pass for legacy Storage-path images ---
    // New posts store https:// URLs directly; this handles any older entries
    // that still carry a gs:// path or a relative Storage ref.
    const storagePathIndices = snapshot.docs.reduce<number[]>((acc, snapshotDoc, i) => {
      const rawImages = normalizeMarketplaceImages(snapshotDoc.data() as Record<string, unknown>);
      if (rawImages.some((img) => !img.startsWith('http') && !img.startsWith('data:'))) {
        acc.push(i);
      }
      return acc;
    }, []);

    if (storagePathIndices.length === 0) return;

    void (async () => {
      try {
        const updated = [...rawPosts];
        await Promise.all(
          storagePathIndices.map(async (i) => {
            const rawData = snapshot.docs[i].data() as Record<string, unknown>;
            const rawImages = normalizeMarketplaceImages(rawData);
            const resolvedImages = (await Promise.all(rawImages.map(resolveMarketplaceImageUrl)))
              .filter((value): value is string => Boolean(value));
            if (resolvedImages.length > 0) {
              updated[i] = { ...updated[i], images: resolvedImages, imageUrl: resolvedImages[0] };
            }
          }),
        );
        if (requestId !== latestSnapshotRequest) return;
        callback(updated);
      } catch (error) {
        // Synchronous data already delivered; log and move on
        reportMarketplaceError(error, OperationType.LIST, MARKETPLACE_COLLECTION);
      }
    })();
  }, (error) => {
    const message = reportMarketplaceError(error, OperationType.LIST, MARKETPLACE_COLLECTION);
    onError?.(message);
  });
}

/**
 * Deletes a marketplace post (Admin only).
 */
export async function deleteMarketplacePost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, MARKETPLACE_COLLECTION, postId));
  } catch (error) {
    reportMarketplaceError(error, OperationType.DELETE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

/**
 * Cancels a marketplace post (User owned).
 */
export async function cancelMarketplacePost(postId: string): Promise<void> {
  try {
    await updatePostStatus(postId, 'cerrada');
  } catch (error) {
    reportMarketplaceError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}
