import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => 'ts'),
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
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('../firebase', () => firebaseMocks);

import { createPost } from '../services/communityService';
import { createMarketplacePost } from '../services/marketplaceService';
import { createSquad } from '../services/squadService';

describe('integración: consistencia entre servicios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1', displayName: 'Eco' };
    firestoreMocks.collection.mockReturnValue('collection-ref');
    firestoreMocks.addDoc.mockResolvedValue({ id: 'new-id' });
  });

  it('servicios comparten guard de autenticación', async () => {
    firebaseMocks.auth.currentUser = null;

    await expect(
      createMarketplacePost('doy', 'Título', 'Contenido', 'otros', [], 'Contacto'),
    ).rejects.toThrow('User must be authenticated');
    await expect(createPost({} as any)).rejects.toThrow('User must be authenticated');
    await expect(createSquad('T', 'D', '2026-04-12', '10:00', 'Plaza')).rejects.toThrow(
      'User must be authenticated',
    );
  });

  it('servicios sanitizan texto antes de persistir', async () => {
    await createMarketplacePost(
      'doy',
      '<b>Título</b>',
      ' <i>Contenido</i> ',
      'otros',
      [],
      ' +54 11 1111 ',
    );
    await createPost({
      uid: 'x',
      type: 'doy',
      title: 'Título',
      content: ' <script>alert(1)</script> Hola ',
      tag: 'ropa',
      images: [],
      contact: '123',
      createdAt: {} as any,
      status: 'disponible',
      createdBy: 'x',
      createdByName: 'x',
    } as any);
    await createSquad(
      '<b>Cuadrilla</b>',
      ' <i>Descripción de cuadrilla</i> ',
      '2026-04-12',
      '10:00',
      ' <u>Plaza</u> ',
    );

    const payloads = firestoreMocks.addDoc.mock.calls.map((call) => call[1]);

    expect(payloads[0]).toEqual(
      expect.objectContaining({
        title: 'Título',
        content: 'Contenido',
        contact: '+54 11 1111',
      }),
    );
    expect(payloads[1]).toEqual(
      expect.objectContaining({
        content: 'alert(1) Hola',
      }),
    );
    expect(payloads[2]).toEqual(
      expect.objectContaining({
        title: 'Cuadrilla',
        description: 'Descripción de cuadrilla',
        location: 'Plaza',
      }),
    );
  });
});
