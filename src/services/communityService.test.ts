import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  arrayUnion: vi.fn((value: unknown) => ({ op: 'arrayUnion', value })),
  arrayRemove: vi.fn((value: unknown) => ({ op: 'arrayRemove', value })),
  getDoc: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: {},
  auth: {
    currentUser: { uid: 'user-1', displayName: 'Eco' } as
      | { uid: string; displayName?: string | null }
      | null,
  },
  handleFirestoreError: vi.fn(),
  cleanFirestoreData: vi.fn((value: unknown) => value),
  OperationType: {
    CREATE: 'create',
    UPDATE: 'update',
    LIST: 'list',
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  createPost,
  createSquad,
  joinSquad,
  leaveSquad,
  subscribeToPosts,
  subscribeToSquads,
  updatePostStatus,
} from './communityService';

describe('communityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1', displayName: 'Eco' };
    firestoreMocks.collection.mockReturnValue('collection-ref');
    firestoreMocks.doc.mockReturnValue('doc-ref');
    firestoreMocks.query.mockReturnValue('query-ref');
    firestoreMocks.orderBy.mockReturnValue('order-by-ref');
  });

  it('createSquad requiere auth y crea doc', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'sq-1' });

    const id = await createSquad({
      title: 'Limpieza',
      description: 'Descripción',
      date: '2026-04-12',
      time: '10:00',
      location: 'Plaza',
      maxParticipants: 20,
    } as any);

    expect(id).toBe('sq-1');
    expect(firestoreMocks.addDoc).toHaveBeenCalledTimes(1);
  });

  it('joinSquad y leaveSquad actualizan asistentes', async () => {
    await joinSquad('sq-1');
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith('doc-ref', {
      attendees: { op: 'arrayUnion', value: 'user-1' },
    });

    await leaveSquad('sq-1');
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith('doc-ref', {
      attendees: { op: 'arrayRemove', value: 'user-1' },
    });
  });

  it('createPost sanitiza contenido y crea doc', async () => {
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'p-1' });

    const id = await createPost({
      uid: 'ignored',
      type: 'doy',
      title: 'Título',
      content: '<b>Contenido</b>',
      tag: 'ropa',
      images: [],
      contact: '123',
      createdAt: {} as any,
      status: 'disponible',
      createdBy: 'x',
      createdByName: 'x',
    } as any);

    expect(id).toBe('p-1');
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
      content: 'Contenido',
      createdBy: 'user-1',
      createdByName: 'Eco',
    }));
  });

  it('updatePostStatus falla si post no existe o no es dueño', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(updatePostStatus('p-1', 'reservado' as any)).rejects.toThrow('Post not found');

    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ createdBy: 'other-user' }),
    });
    await expect(updatePostStatus('p-1', 'reservado' as any)).rejects.toThrow(
      'Only the creator can update status',
    );
  });

  it('updatePostStatus actualiza cuando el dueño coincide', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ createdBy: 'user-1' }),
    });
    await updatePostStatus('p-1', 'reservado' as any);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', { status: 'reservado' });
  });

  it('subscribeToSquads y subscribeToPosts mapean snapshots', () => {
    const squadsCb = vi.fn();
    const postsCb = vi.fn();

    firestoreMocks.onSnapshot
      .mockImplementationOnce((_query, onNext) => {
        onNext({
          docs: [{ id: 's1', data: () => ({ title: 'Sq' }) }],
        });
        return vi.fn();
      })
      .mockImplementationOnce((_query, onNext) => {
        onNext({
          docs: [{ id: 'p1', data: () => ({ title: 'Post' }) }],
        });
        return vi.fn();
      });

    subscribeToSquads(squadsCb);
    subscribeToPosts(postsCb);

    expect(squadsCb).toHaveBeenCalledWith([{ id: 's1', title: 'Sq' }]);
    expect(postsCb).toHaveBeenCalledWith([{ id: 'p1', title: 'Post' }]);
  });

  it('subscribeToSquads invoca handleFirestoreError en error', () => {
    const cb = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_q, _onNext, onError) => {
      onError(new Error('snapshot error'));
      return vi.fn();
    });

    subscribeToSquads(cb);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('subscribeToPosts invoca handleFirestoreError en error', () => {
    const cb = vi.fn();

    firestoreMocks.onSnapshot.mockImplementationOnce((_q, _onNext, onError) => {
      onError(new Error('posts error'));
      return vi.fn();
    });

    subscribeToPosts(cb);

    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('createSquad usa displayName por defecto cuando es null', async () => {
    firebaseMocks.auth.currentUser = { uid: 'user-2', displayName: null };
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'sq-2' });

    const id = await createSquad({ title: 'Evento', description: 'D' } as any);

    expect(id).toBe('sq-2');
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
      createdByName: 'Usuario EcoWarrior',
    }));
  });

  it('createSquad falla sin usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(createSquad({ title: 'T' } as any)).rejects.toThrow('User must be authenticated');
  });

  it('createSquad propaga error de Firestore', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('fs error'));
    await expect(createSquad({ title: 'T', description: 'D' } as any)).rejects.toThrow('fs error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('joinSquad falla sin usuario', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(joinSquad('sq-1')).rejects.toThrow('User must be authenticated');
  });

  it('joinSquad propaga error de Firestore', async () => {
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('join error'));
    await expect(joinSquad('sq-1')).rejects.toThrow('join error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('leaveSquad falla sin usuario', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(leaveSquad('sq-1')).rejects.toThrow('User must be authenticated');
  });

  it('leaveSquad propaga error de Firestore', async () => {
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('leave error'));
    await expect(leaveSquad('sq-1')).rejects.toThrow('leave error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('createPost falla sin usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(createPost({ content: 'c' } as any)).rejects.toThrow('User must be authenticated');
  });

  it('createPost usa displayName por defecto cuando no existe', async () => {
    firebaseMocks.auth.currentUser = { uid: 'user-2', displayName: null };
    firestoreMocks.addDoc.mockResolvedValueOnce({ id: 'p-2' });

    const id = await createPost({ content: 'hola', type: 'doy' } as any);

    expect(id).toBe('p-2');
    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('collection-ref', expect.objectContaining({
      createdByName: 'Usuario EcoWarrior',
    }));
  });

  it('createPost propaga error de Firestore', async () => {
    firestoreMocks.addDoc.mockRejectedValueOnce(new Error('create post error'));
    await expect(createPost({ content: 'c' } as any)).rejects.toThrow('create post error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('updatePostStatus falla sin usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(updatePostStatus('p-1', 'reservado' as any)).rejects.toThrow('User must be authenticated');
  });

  it('updatePostStatus propaga error de Firestore', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('getDoc error'));
    await expect(updatePostStatus('p-1', 'reservado' as any)).rejects.toThrow('getDoc error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });
});
