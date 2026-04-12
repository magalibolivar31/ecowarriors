import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  auth: {
    currentUser: { uid: 'user-1' } as { uid: string } | null,
  },
  handleFirestoreError: vi.fn(),
  cleanFirestoreData: vi.fn((value: unknown) => value),
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LIST: 'list',
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  cancelMarketplacePost,
  createMarketplacePost,
  deleteMarketplacePost,
  subscribeToMarketplace,
  updatePostStatus,
} from './marketplaceService';

describe('marketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1' };
    firestoreMocks.collection.mockReturnValue('collection-ref');
    firestoreMocks.doc.mockReturnValue('doc-ref');
    firestoreMocks.query.mockReturnValue('query-ref');
    firestoreMocks.orderBy.mockReturnValue('order-by-ref');
  });

  it('createMarketplacePost requiere usuario', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(
      createMarketplacePost('doy', 't', 'c', 'otros', [], 'contacto'),
    ).rejects.toThrow('User must be authenticated');
  });

  it('createMarketplacePost sanitiza y crea publicación', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'post-1' });

    const id = await createMarketplacePost(
      'doy',
      '<b>Título</b>',
      ' <i>Contenido</i> ',
      'otros',
      ['img1'],
      '  +54 11 1111 1111 ',
    );

    expect(id).toBe('post-1');
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', {
      uid: 'user-1',
      type: 'doy',
      title: 'Título',
      content: 'Contenido',
      tag: 'otros',
      images: ['img1'],
      contact: '+54 11 1111 1111',
      status: 'disponible',
      createdAt: 'ts',
    });
  });

  it('updatePostStatus actualiza estado', async () => {
    await updatePostStatus('post-1', 'reservado');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', { status: 'reservado' });
  });

  it('cancelMarketplacePost marca vencido', async () => {
    await cancelMarketplacePost('post-1');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', { status: 'vencido' });
  });

  it('deleteMarketplacePost elimina documento', async () => {
    await deleteMarketplacePost('post-1');
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('subscribeToMarketplace transforma docs', () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      onNext({
        docs: [
          {
            id: 'p1',
            data: () => ({ title: 'Publicación' }),
          },
        ],
      });
      return unsubscribe;
    });

    const unSub = subscribeToMarketplace(callback);

    expect(callback).toHaveBeenCalledWith([{ id: 'p1', title: 'Publicación' }]);
    expect(unSub).toBe(unsubscribe);
  });
});
