import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

const firebaseMocks = vi.hoisted(() => ({
  db: { __type: 'db' },
  storage: { __type: 'storage' },
  auth: {
    currentUser: { uid: 'user-1' } as { uid: string } | null,
  },
  handleFirestoreError: vi.fn(),
  cleanFirestoreData: vi.fn((value: unknown) => value),
  OperationType: {
    GET: 'get',
    UPDATE: 'update',
  },
}));

vi.mock('firebase/firestore', () => firestoreMocks);
vi.mock('firebase/storage', () => storageMocks);
vi.mock('../firebase', () => firebaseMocks);

import {
  getUserProfile,
  getUserSettings,
  updateUserProfile,
  updateUserSettings,
  uploadProfilePhoto,
} from './userService';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseMocks.auth.currentUser = { uid: 'user-1' };
    firestoreMocks.doc.mockReturnValue('doc-ref');
  });

  it('getUserSettings devuelve null sin sesión', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(getUserSettings()).resolves.toBeNull();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  });

  it('getUserSettings retorna datos cuando el documento existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ uid: 'user-1', onboardingCompleted: true }),
    });

    await expect(getUserSettings()).resolves.toEqual({
      uid: 'user-1',
      onboardingCompleted: true,
    });
  });

  it('getUserSettings retorna null cuando el documento no existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(getUserSettings()).resolves.toBeNull();
  });

  it('getUserSettings retorna null cuando falla getDoc', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('getDoc failed'));

    await expect(getUserSettings()).resolves.toBeNull();
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('updateUserSettings requiere usuario autenticado', async () => {
    firebaseMocks.auth.currentUser = null;
    await expect(updateUserSettings({ onboardingCompleted: true })).rejects.toThrow('User must be authenticated');
  });

  it('updateUserSettings usa setDoc con merge de valores si ya existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        uid: 'user-1',
        onboardingCompleted: true,
        crisisRemindersEnabled: false,
        meetingPoint: { place: 'Plaza' },
        trustedContacts: [{ name: 'A', phone: '123' }],
      }),
    });

    await updateUserSettings({ onboardingCompleted: true });

    expect(firestoreMocks.setDoc).toHaveBeenCalledWith('doc-ref', {
      uid: 'user-1',
      onboardingCompleted: true,
      crisisRemindersEnabled: false,
      meetingPoint: { place: 'Plaza' },
      trustedContacts: [{ name: 'A', phone: '123' }],
      locationPrivacy: false,
    });
  });

  it('updateUserSettings usa setDoc con defaults completos si no existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await updateUserSettings({ crisisRemindersEnabled: true } as any);

    expect(firestoreMocks.setDoc).toHaveBeenCalledWith('doc-ref', {
      uid: 'user-1',
      onboardingCompleted: false,
      crisisRemindersEnabled: true,
      meetingPoint: { place: '' },
      trustedContacts: [],
      locationPrivacy: false,
    });
  });

  it('updateUserSettings propaga error de Firestore', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('settings error'));

    await expect(updateUserSettings({ onboardingCompleted: true })).rejects.toThrow('settings error');
    expect(firebaseMocks.handleFirestoreError).toHaveBeenCalled();
  });

  it('updateUserProfile sanea texto antes de persistir', async () => {
    await updateUserProfile('user-1', {
      alias: '<b>Ana</b>',
      zone: '  <i>Palermo</i> ',
      commitment: '  javascript:alto  ',
      xp: 120,
    });

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      alias: 'Ana',
      zone: 'Palermo',
      commitment: 'alto',
      xp: 120,
    });
  });

  it('updateUserProfile propaga error', async () => {
    firestoreMocks.updateDoc.mockRejectedValueOnce(new Error('profile update error'));

    await expect(updateUserProfile('user-1', { alias: 'Test' })).rejects.toThrow('profile update error');
  });

  it('getUserProfile devuelve datos cuando el documento existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ alias: 'Eco', xp: 200 }),
    });

    await expect(getUserProfile('user-1')).resolves.toEqual({ alias: 'Eco', xp: 200 });
  });

  it('getUserProfile devuelve null cuando el documento no existe', async () => {
    firestoreMocks.getDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(getUserProfile('user-1')).resolves.toBeNull();
  });

  it('getUserProfile devuelve null cuando falla getDoc', async () => {
    firestoreMocks.getDoc.mockRejectedValueOnce(new Error('fail'));
    await expect(getUserProfile('user-1')).resolves.toBeNull();
  });

  it('uploadProfilePhoto sube archivo, obtiene URL y actualiza perfil', async () => {
    const file = { name: 'avatar.jpg', type: 'image/jpeg' } as unknown as File;

    storageMocks.ref.mockReturnValue('storage-ref');
    storageMocks.uploadBytes.mockResolvedValueOnce(undefined);
    storageMocks.getDownloadURL.mockResolvedValueOnce('https://cdn/avatar.jpg');

    const result = await uploadProfilePhoto('user-1', file);

    expect(storageMocks.uploadBytes).toHaveBeenCalledWith('storage-ref', file);
    expect(result).toBe('https://cdn/avatar.jpg');
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('doc-ref', {
      photoURL: 'https://cdn/avatar.jpg',
    });
  });
});
