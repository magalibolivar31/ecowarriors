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

const storageMocks = vi.hoisted(() => ({
  ref: vi.fn(),
  uploadString: vi.fn(),
  getDownloadURL: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  storage: {},
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
vi.mock('firebase/storage', () => storageMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  cancelMarketplacePost,
  createMarketplacePost,
  deleteMarketplacePost,
  subscribeToMarketplace,
  updatePostStatus,
} from './marketplaceService';

describe('marketplaceService', () => {
  const withThrowingSpreadField = (
    message: string,
    baseData: Record<string, unknown> = {},
  ): Record<string, unknown> => {
    const data = { ...baseData };
    Object.defineProperty(data, 'brokenField', {
      enumerable: true,
      get() {
        throw new Error(message);
      },
    });
    return data;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1' };
    firestoreMocks.collection.mockReturnValue('collection-ref');
    firestoreMocks.doc.mockReturnValue('doc-ref');
    firestoreMocks.query.mockReturnValue('query-ref');
    firestoreMocks.orderBy.mockReturnValue('order-by-ref');
    storageMocks.ref.mockImplementation((_storage, path) => `ref:${path}`);
    storageMocks.uploadString.mockResolvedValue(undefined);
    storageMocks.getDownloadURL.mockImplementation(async (storageRef: string) => `https://cdn.test/${storageRef}`);
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

  it('createMarketplacePost normaliza type e imágenes antes de guardar', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'post-2' });

    await createMarketplacePost(
      '  DOY  ' as unknown as 'doy',
      'Título',
      'Contenido',
      'otros',
      [' img1 ', '', '   ', 'img2'],
      'contacto',
    );

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', {
      uid: 'user-1',
      type: 'doy',
      title: 'Título',
      content: 'Contenido',
      tag: 'otros',
      images: ['img1', 'img2'],
      contact: 'contacto',
      status: 'disponible',
      createdAt: 'ts',
    });
  });

  it('createMarketplacePost sube imágenes base64 y guarda URLs en Firestore', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'post-3' });

    await createMarketplacePost(
      'doy',
      'Título',
      'Contenido',
      'otros',
      ['data:image/jpeg;base64,abc123'],
      'contacto',
    );

    expect(storageMocks.uploadString).toHaveBeenCalledTimes(1);
    expect(storageMocks.uploadString).toHaveBeenCalledWith(
      expect.stringContaining('ref:marketplace/user-1/'),
      'abc123',
      'base64',
    );
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith(
      'collection-ref',
      expect.objectContaining({
        images: [expect.stringMatching(/^https:\/\/cdn\.test\/ref:marketplace\/user-1\//)],
      }),
    );
  });

  it('createMarketplacePost rechaza data URL inválida', async () => {
    await expect(
      createMarketplacePost(
        'doy',
        'Título',
        'Contenido',
        'otros',
        ['data:image/jpeg;base64,'],
        'contacto',
      ),
    ).rejects.toThrow('Invalid marketplace image data URL');
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

  it('subscribeToMarketplace transforma docs', async () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
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

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    expect(callback).toHaveBeenCalledWith([{ id: 'p1', title: 'Publicación' }]);
    expect(unSub).toBe(unsubscribe);
  });

  it('subscribeToMarketplace normaliza y resuelve imágenes legacy', async () => {
    const callback = vi.fn();
    const unsubscribe = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'p1',
            data: () => ({
              title: 'Con imagen',
              images: [{ imageUrl: 'marketplace/a.jpg' }, 'https://img.test/x.jpg', ''],
            }),
          },
          {
            id: 'p2',
            data: () => ({
              title: 'Con imageUrl',
              imageUrl: '/marketplace/b.jpg',
            }),
          },
          {
            id: 'p3',
            data: () => ({
              title: 'Con image',
              image: { url: 'marketplace/c.jpg' },
            }),
          },
        ],
      });
      return unsubscribe;
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'p1',
        title: 'Con imagen',
        images: ['https://cdn.test/ref:marketplace/a.jpg', 'https://img.test/x.jpg'],
      },
      {
        id: 'p2',
        title: 'Con imageUrl',
        imageUrl: '/marketplace/b.jpg',
        images: ['https://cdn.test/ref:marketplace/b.jpg'],
      },
      {
        id: 'p3',
        title: 'Con image',
        image: { url: 'marketplace/c.jpg' },
        images: ['https://cdn.test/ref:marketplace/c.jpg'],
      },
    ]);
  });

  it('subscribeToMarketplace normaliza type y status legacy', async () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'p1',
            data: () => ({
              type: 'DOY',
              status: 'Disponible',
              title: 'Normalizado',
            }),
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'p1',
        type: 'doy',
        status: 'disponible',
        title: 'Normalizado',
      },
    ]);
  });

  it('subscribeToMarketplace descarta imágenes no resolubles de storage', async () => {
    const callback = vi.fn();

    storageMocks.getDownloadURL.mockRejectedValueOnce(new Error('missing file'));

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'p1',
            data: () => ({
              title: 'Con imagen inválida',
              images: ['marketplace/not-found.jpg', 'https://img.test/ok.jpg'],
            }),
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'p1',
        title: 'Con imagen inválida',
        images: ['https://img.test/ok.jpg'],
      },
    ]);
  });

  it('subscribeToMarketplace ignora imágenes vacías en la resolución', async () => {
    const callback = vi.fn();
    const nativeFilter = Array.prototype.filter;
    const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
      this: unknown[],
      predicate: (value: unknown, index: number, array: unknown[]) => unknown,
      thisArg?: unknown,
    ) {
      const filtered = nativeFilter.call(this, predicate, thisArg);
      if (
        this.includes('https://img.test/ok.jpg')
        && this.includes('')
        && !filtered.includes('')
      ) {
        return [...filtered, ''] as unknown[];
      }
      return filtered;
    });

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'p1',
            data: () => ({
              title: 'Con imagen vacía',
              images: ['', 'https://img.test/ok.jpg'],
            }),
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(callback).toHaveBeenCalledWith([
      {
        id: 'p1',
        title: 'Con imagen vacía',
        images: ['https://img.test/ok.jpg'],
      },
    ]);

    filterSpy.mockRestore();
  });

  it('subscribeToMarketplace descarta respuestas atrasadas exitosas', async () => {
    const callback = vi.fn();
    let resolveFirstImage: ((value: string) => void) | undefined;

    storageMocks.getDownloadURL
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstImage = resolve;
      }))
      .mockImplementation(async (storageRef: string) => `https://cdn.test/${storageRef}`);

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'old',
            data: () => ({
              title: 'Antigua',
              images: ['marketplace/slow.jpg'],
            }),
          },
        ],
      });
      void onNext({
        docs: [
          {
            id: 'new',
            data: () => ({
              title: 'Nueva',
            }),
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith([{ id: 'new', title: 'Nueva' }]);
    });

    resolveFirstImage?.('https://cdn.test/ref:marketplace/slow.jpg');

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  it('subscribeToMarketplace descarta fallback atrasado cuando falla snapshot viejo', async () => {
    const callback = vi.fn();
    let resolveFirstImage: ((value: string) => void) | undefined;

    storageMocks.getDownloadURL
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstImage = resolve;
      }))
      .mockImplementation(async (storageRef: string) => `https://cdn.test/${storageRef}`);

    const staleData = withThrowingSpreadField('Snapshot data read failed', {
      title: 'Snapshot viejo',
      images: ['marketplace/slow.jpg'],
    });

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'old',
            data: () => staleData,
          },
        ],
      });
      void onNext({
        docs: [
          {
            id: 'new',
            data: () => ({
              title: 'Snapshot nuevo',
            }),
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledWith([{ id: 'new', title: 'Snapshot nuevo' }]);
    });

    resolveFirstImage?.('https://cdn.test/ref:marketplace/slow.jpg');

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    expect(firebaseMocks.handleFirestoreError).not.toHaveBeenCalled();
  });

  it('subscribeToMarketplace usa fallback cuando falla el procesamiento del snapshot', async () => {
    const callback = vi.fn();
    const snapshotData = vi
      .fn()
      .mockReturnValueOnce(withThrowingSpreadField('Snapshot data read failed'))
      .mockReturnValueOnce({ title: 'Fallback post' });

    firestoreMocks.onSnapshot.mockImplementationOnce((_query, onNext) => {
      void onNext({
        docs: [
          {
            id: 'p1',
            data: snapshotData,
          },
        ],
      });
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledWith(
      expect.any(Error),
      firebaseMocks.OperationType.LIST,
      'marketplace',
    );
    expect(callback).toHaveBeenCalledWith([{ id: 'p1', title: 'Fallback post' }]);
  });

  it('subscribeToMarketplace llama handleFirestoreError en error', () => {
    const callback = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_q, _onNext, onError) => {
      onError(new Error('marketplace error'));
      return vi.fn();
    });

    subscribeToMarketplace(callback);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it('deleteMarketplacePost propaga error de Firestore', async () => {
    firestoreMocks.deleteDoc.mockRejectedValueOnce(new Error('delete error'));
    await expect(deleteMarketplacePost('post-1')).rejects.toThrow('delete error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('cancelMarketplacePost propaga error de Firestore', async () => {
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('cancel error'));
    await expect(cancelMarketplacePost('post-1')).rejects.toThrow('cancel error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('updatePostStatus requiere usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(updatePostStatus('post-1', 'reservado')).rejects.toThrow('User must be authenticated');
  });

  it('updatePostStatus propaga error de Firestore', async () => {
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('update error'));
    await expect(updatePostStatus('post-1', 'reservado')).rejects.toThrow('update error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('createMarketplacePost propaga error de Firestore', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('create error'));
    await expect(
      createMarketplacePost('doy', 'T', 'C', 'otros', [], 'contacto'),
    ).rejects.toThrow('create error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });
});
