
import { MedicalDevice, MedicalTask, Invoice } from '../types';

const DB_NAME = 'MediTrackDB';
const STORE_DEVICES = 'devices';
const STORE_TASKS = 'tasks';
const STORE_INVOICES = 'invoices';
const DB_VERSION = 4;

let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // If an old tab holds the DB at a previous version, the upgrade blocks
    // forever and the whole app would hang on the loading screen.
    // Fail after 5s instead so the UI can start with empty data and retry later.
    const timeout = setTimeout(() => {
      dbPromise = null;
      reject(new Error('IndexedDB open timed out — close other tabs running this app and reload.'));
    }, 5000);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DEVICES)) {
        db.createObjectStore(STORE_DEVICES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_INVOICES)) {
        db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
      }
    };

    request.onblocked = () => {
      console.warn('[Storage] DB upgrade blocked — another tab has the app open with an older version.');
    };

    request.onsuccess = (event: any) => {
      clearTimeout(timeout);
      const db = event.target.result;
      // When a future version wants to upgrade, release our connection
      // so THIS tab never blocks other tabs.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = (event: any) => {
      clearTimeout(timeout);
      dbPromise = null; // Reset on error so next call can retry
      reject(event.target.error);
    };
  });

  return dbPromise;
};

export const saveDevicesToDB = async (devices: MedicalDevice[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DEVICES, 'readwrite');
    const store = transaction.objectStore(STORE_DEVICES);
    for (const device of devices) {
      store.put(device);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteDeviceFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_DEVICES, 'readwrite');
      const store = transaction.objectStore(STORE_DEVICES);
      
      // We use String(id) to ensure type consistency for the key
      const key = String(id).trim();
      const request = store.delete(key);
      
      request.onsuccess = () => {
        console.log(`[Storage] Purge request accepted for ID: ${key}`);
      };

      transaction.oncomplete = () => {
        console.log(`[Storage] Purge transaction committed successfully for ID: ${key}`);
        resolve();
      };
      
      transaction.onerror = (event: any) => {
        console.error(`[Storage] Purge transaction failed for ID: ${key}`, event.target.error);
        reject(event.target.error);
      };
    } catch (e) {
      console.error("[Storage] Critical failure during purge initiation:", e);
      reject(e);
    }
  });
};

export const getAllDevicesFromDB = async (): Promise<MedicalDevice[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DEVICES, 'readonly');
    const store = transaction.objectStore(STORE_DEVICES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const saveTasksToDB = async (tasks: MedicalTask[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_TASKS, 'readwrite');
    const store = transaction.objectStore(STORE_TASKS);
    for (const task of tasks) {
      store.put(task);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteTaskFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_TASKS, 'readwrite');
    const store = transaction.objectStore(STORE_TASKS);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const getAllTasksFromDB = async (): Promise<MedicalTask[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_TASKS, 'readonly');
    const store = transaction.objectStore(STORE_TASKS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const saveInvoicesToDB = async (invoices: Invoice[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_INVOICES, 'readwrite');
    const store = transaction.objectStore(STORE_INVOICES);
    for (const invoice of invoices) {
      store.put(invoice);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteInvoiceFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_INVOICES, 'readwrite');
    const store = transaction.objectStore(STORE_INVOICES);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const getAllInvoicesFromDB = async (): Promise<Invoice[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_INVOICES, 'readonly');
    const store = transaction.objectStore(STORE_INVOICES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const getStorageStats = async () => {
  const db = await initDB();
  return new Promise<{ count: number }>((resolve) => {
    const transaction = db.transaction(STORE_DEVICES, 'readonly');
    const store = transaction.objectStore(STORE_DEVICES);
    const countRequest = store.count();
    countRequest.onsuccess = () => resolve({ count: countRequest.result });
  });
};
