import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyCrisisModeChanged,
  notifyReportStatusChanged,
  notifySquadCancelled,
  notifySquadConfirmed,
  notifyVolunteerRegistered,
  requestNotificationPermission,
  showNotification,
} from './notificationService';

type MockNotificationCtor = {
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
  new (...args: any[]): any;
};

function installNotification(permission: NotificationPermission) {
  const created: Array<{ title: string; options: NotificationOptions }> = [];

  const NotificationMock = function (this: any, title: string, options: NotificationOptions) {
    created.push({ title, options });
  } as unknown as MockNotificationCtor;

  NotificationMock.permission = permission;
  NotificationMock.requestPermission = vi.fn().mockResolvedValue(permission);

  (globalThis as any).window = { Notification: NotificationMock };
  (globalThis as any).Notification = NotificationMock;

  return { created, NotificationMock };
}

describe('notificationService', () => {
  const originalWindow = (globalThis as any).window;
  const originalNotification = (globalThis as any).Notification;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).Notification = originalNotification;
  });

  it('requestNotificationPermission devuelve false si el navegador no soporta Notification', async () => {
    (globalThis as any).window = {};
    delete (globalThis as any).Notification;

    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('requestNotificationPermission respeta permisos existentes', async () => {
    installNotification('granted');
    await expect(requestNotificationPermission()).resolves.toBe(true);

    installNotification('denied');
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('requestNotificationPermission solicita permiso cuando es default', async () => {
    const { NotificationMock } = installNotification('default');
    NotificationMock.requestPermission.mockResolvedValueOnce('granted');

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(NotificationMock.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('showNotification crea notificación solo con permiso granted', () => {
    const granted = installNotification('granted');
    showNotification('Título', 'Mensaje', '/icon.png');
    expect(granted.created).toHaveLength(1);
    expect(granted.created[0]).toEqual({
      title: 'Título',
      options: {
        body: 'Mensaje',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: 'ecowarriors-notification',
      },
    });

    const denied = installNotification('denied');
    showNotification('Otro', 'Mensaje');
    expect(denied.created).toHaveLength(0);
  });

  it('wrappers de notificación emiten mensajes específicos', () => {
    const { created } = installNotification('granted');

    notifyReportStatusChanged('Basural', 'Resuelto');
    notifySquadConfirmed('Limpieza Norte');
    notifySquadCancelled('Limpieza Norte');
    notifyCrisisModeChanged(true);
    notifyCrisisModeChanged(false);
    notifyVolunteerRegistered();

    expect(created.map((item) => item.title)).toEqual([
      'Actualización de Reporte',
      'Cuadrilla Confirmada',
      'Cuadrilla Cancelada',
      '⚠️ Modo Crisis Activado',
      '✅ Modo Crisis Desactivado',
      '¡Bienvenido Voluntario!',
    ]);
  });
});
