import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, cleanFirestoreData, storage } from '../firebase';
import { MarketplacePost } from '../types';
import { sanitizeText } from '../lib/utils';

const MARKETPLACE_COLLECTION = 'marketplace';

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
  
  try {
    const postData = {
      uid,
      type,
      title: sanitizeText(title),
      content: sanitizeText(content),
      tag,
      images,
      contact: sanitizeText(contact),
      status: 'disponible',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTION), cleanFirestoreData(postData));
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, MARKETPLACE_COLLECTION);
    throw error;
  }
}

export async function updatePostStatus(
  postId: string, 
  status: 'disponible' | 'reservado' | 'entregado/resuelto' | 'vencido'
): Promise<void> {
  if (!auth.currentUser) throw new Error('User must be authenticated');
  
  try {
    const postRef = doc(db, MARKETPLACE_COLLECTION, postId);
    await updateDoc(postRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

export function subscribeToMarketplace(callback: (posts: MarketplacePost[]) => void) {
  const q = query(collection(db, MARKETPLACE_COLLECTION), orderBy('createdAt', 'desc'));
  let latestSnapshotRequest = 0;

  return onSnapshot(q, (snapshot) => {
    const requestId = ++latestSnapshotRequest;
    void (async () => {
      try {
        const posts = await Promise.all(snapshot.docs.map(async (snapshotDoc) => {
          const rawData = snapshotDoc.data() as Record<string, unknown>;
          const rawImages = normalizeMarketplaceImages(rawData);
          const resolvedImages = (await Promise.all(rawImages.map(resolveMarketplaceImageUrl)))
            .filter((value): value is string => Boolean(value));

          return {
            id: snapshotDoc.id,
            ...rawData,
            ...(rawImages.length > 0 ? { images: resolvedImages } : {}),
          } as MarketplacePost;
        }));

        if (requestId !== latestSnapshotRequest) return;
        callback(posts);
      } catch (error) {
        if (requestId !== latestSnapshotRequest) return;
        handleFirestoreError(error, OperationType.LIST, MARKETPLACE_COLLECTION);
        const fallbackPosts = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...(snapshotDoc.data() as Record<string, unknown>),
        } as MarketplacePost));
        callback(fallbackPosts);
      }
    })();
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, MARKETPLACE_COLLECTION);
  });
}

/**
 * Deletes a marketplace post (Admin only).
 */
export async function deleteMarketplacePost(postId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, MARKETPLACE_COLLECTION, postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

/**
 * Cancels a marketplace post (User owned).
 */
export async function cancelMarketplacePost(postId: string): Promise<void> {
  try {
    await updateDoc(doc(db, MARKETPLACE_COLLECTION, postId), {
      status: 'vencido'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}
