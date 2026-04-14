import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp, 
  query, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { db, auth, handleFirestoreError, OperationType, cleanFirestoreData, storage } from '../firebase';
import { MarketplacePost } from '../types';
import { sanitizeText } from '../lib/utils';

const MARKETPLACE_COLLECTION = 'marketplace';
const LEGACY_POSTS_COLLECTION = 'posts';
const ACTIVE_MARKETPLACE_STATUSES = new Set(['activa', 'disponible', 'reservado']);

type MarketplaceSubscriptionOptions = {
  includeLegacyPosts?: boolean;
  onError?: (error: unknown) => void;
};

export function normalizeMarketplaceType(value: unknown): 'doy' | 'recibo' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'doy' || normalized === 'recibo') return normalized;
  return null;
}

export function isMarketplacePostActive(post: Pick<MarketplacePost, 'status' | 'isActive'>): boolean {
  if (post.isActive === false) return false;
  const normalizedStatus = typeof post.status === 'string' ? post.status.trim().toLowerCase() : '';
  if (!normalizedStatus) return true;
  return ACTIVE_MARKETPLACE_STATUSES.has(normalizedStatus);
}

async function normalizeMarketplacePost(snapshotDoc: { id: string; data: () => Record<string, unknown> }): Promise<MarketplacePost> {
  const rawData = snapshotDoc.data();
  const rawImages = normalizeMarketplaceImages(rawData);
  const resolvedImages = (await Promise.all(rawImages.map(resolveMarketplaceImageUrl)))
    .filter((value): value is string => Boolean(value));
  const normalizedType = normalizeMarketplaceType(rawData.type);
  const normalizedStatus = normalizeMarketplaceStatus(rawData.status);

  return {
    id: snapshotDoc.id,
    ...rawData,
    ...(typeof rawData.description === 'string' ? { description: rawData.description } : {}),
    ...(typeof rawData.content === 'string' ? {} : (typeof rawData.description === 'string' ? { content: rawData.description } : {})),
    ...(typeof rawData.category === 'string' ? { category: rawData.category } : (typeof rawData.tag === 'string' ? { category: rawData.tag } : {})),
    ...(normalizedType ? { type: normalizedType } : {}),
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(rawImages.length > 0 ? { images: resolvedImages } : {}),
    ...(resolvedImages[0] ? { imageUrl: resolvedImages[0] } : (typeof rawData.imageUrl === 'string' ? { imageUrl: rawData.imageUrl } : {})),
  } as MarketplacePost;
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

    console.info('[marketplace] creating post', {
      collection: MARKETPLACE_COLLECTION,
      uid,
      type: normalizedType,
      hasImage: Boolean(firstImage),
      status,
    });
    const docRef = await addDoc(collection(db, MARKETPLACE_COLLECTION), cleanFirestoreData(postData));
    console.info('[marketplace] post created', { collection: MARKETPLACE_COLLECTION, postId: docRef.id });
    return docRef.id;
  } catch (error) {
    console.error('[marketplace] create failed', { collection: MARKETPLACE_COLLECTION, error });
    handleFirestoreError(error, OperationType.CREATE, MARKETPLACE_COLLECTION);
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
    await updateDoc(postRef, cleanFirestoreData({
      status,
      isActive: status === 'activa',
      updatedAt: serverTimestamp(),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}

export function subscribeToMarketplace(
  callback: (posts: MarketplacePost[]) => void,
  options: MarketplaceSubscriptionOptions = {},
) {
  const { includeLegacyPosts = false, onError } = options;
  const q = query(collection(db, MARKETPLACE_COLLECTION), orderBy('createdAt', 'desc'));
  const legacyQuery = query(collection(db, LEGACY_POSTS_COLLECTION), orderBy('createdAt', 'desc'));
  let latestSnapshotRequest = 0;
  let marketplacePosts: MarketplacePost[] = [];
  let legacyPosts: MarketplacePost[] = [];

  const notify = () => {
    const merged = [...marketplacePosts, ...legacyPosts];
    const dedupedById = new Map<string, MarketplacePost>();
    for (const post of merged) {
      if (!dedupedById.has(post.id)) {
        dedupedById.set(post.id, post);
      }
    }
    callback(Array.from(dedupedById.values()));
  };

  const handleSnapshotError = (error: unknown, collectionName: string) => {
    console.error('[marketplace] subscription failed', { collection: collectionName, error });
    onError?.(error);
    try {
      handleFirestoreError(error, OperationType.LIST, collectionName);
    } catch (telemetryError) {
      console.warn('[marketplace] telemetry helper rethrew while handling subscription error', {
        collection: collectionName,
        telemetryError,
      });
    }
  };

  const marketplaceUnsubscribe = onSnapshot(q, (snapshot) => {
    const requestId = ++latestSnapshotRequest;
    void (async () => {
      try {
        const posts = await Promise.all(
          snapshot.docs.map((snapshotDoc) => normalizeMarketplacePost({
            id: snapshotDoc.id,
            data: () => snapshotDoc.data() as Record<string, unknown>,
          })),
        );

        if (requestId !== latestSnapshotRequest) return;
        marketplacePosts = posts;
        console.info('[marketplace] snapshot loaded', {
          collection: MARKETPLACE_COLLECTION,
          count: marketplacePosts.length,
        });
        notify();
      } catch (error) {
        if (requestId !== latestSnapshotRequest) return;
        handleSnapshotError(error, MARKETPLACE_COLLECTION);
        const fallbackPosts = snapshot.docs.map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...(snapshotDoc.data() as Record<string, unknown>),
        } as MarketplacePost));
        marketplacePosts = fallbackPosts;
        notify();
      }
    })();
  }, (error) => {
    handleSnapshotError(error, MARKETPLACE_COLLECTION);
  });

  let legacyUnsubscribe: (() => void) | undefined;
  if (includeLegacyPosts) {
    legacyUnsubscribe = onSnapshot(legacyQuery, (snapshot) => {
      void (async () => {
        try {
          const posts = await Promise.all(
            snapshot.docs.map((snapshotDoc) => normalizeMarketplacePost({
              id: snapshotDoc.id,
              data: () => snapshotDoc.data() as Record<string, unknown>,
            })),
          );
          legacyPosts = posts;
          console.info('[marketplace] legacy snapshot loaded', {
            collection: LEGACY_POSTS_COLLECTION,
            count: legacyPosts.length,
          });
          notify();
        } catch (error) {
          handleSnapshotError(error, LEGACY_POSTS_COLLECTION);
          legacyPosts = snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...(snapshotDoc.data() as Record<string, unknown>),
          } as MarketplacePost));
          notify();
        }
      })();
    }, (error) => {
      handleSnapshotError(error, LEGACY_POSTS_COLLECTION);
    });
  }

  if (!includeLegacyPosts) {
    return marketplaceUnsubscribe;
  }

  return () => {
    marketplaceUnsubscribe();
    legacyUnsubscribe?.();
  };
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
    await updatePostStatus(postId, 'cerrada');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${postId}`);
    throw error;
  }
}
