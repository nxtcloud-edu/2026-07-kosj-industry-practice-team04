const DEVICE_KEY = 'moa-anonymous-device-id';

export function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (id) return id;

  id = globalThis.crypto?.randomUUID?.()
    ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY, id);
  return id;
}
