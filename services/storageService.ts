import { MedicalDevice, MedicalTask, Invoice, AuditEntry, Deletion, Referat, FoundationDoc , Comanda } from '../types';

// Numele bazei locale ramane cel vechi dupa redenumirea aplicatiei: schimbarea
// lui ar deschide o baza noua, goala, si ar abandona datele de pe fiecare telefon.
const DB_NAME = 'MediTrackDB';
const STORE_DEVICES = 'devices';
const STORE_TASKS = 'tasks';
const STORE_INVOICES = 'invoices';
const STORE_AUDIT = 'audit';
const STORE_DELETIONS = 'deletions';
const STORE_BLOBS = 'fileblobs';
const STORE_REFERATE = 'referate';
const STORE_FUNDAMENTARE = 'fundamentare';
const STORE_COMENZI = 'comenzi';
const DB_VERSION = 9;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Reported when the local database cannot be opened, so the UI can say so
 *  instead of quietly starting with no data. */
export type StorageProblem = { kind: 'blocked' | 'timeout' | 'error'; message: string };
let storageProblem: StorageProblem | null = null;
const problemListeners = new Set<(p: StorageProblem | null) => void>();

export const getStorageProblem = () => storageProblem;
export const onStorageProblem = (cb: (p: StorageProblem | null) => void) => {
  problemListeners.add(cb);
  return () => problemListeners.delete(cb);
};
const setProblem = (p: StorageProblem | null) => {
  storageProblem = p;
  problemListeners.forEach(cb => cb(p));
};

const OPEN_TIMEOUT_MS = 15000;

/**
 * One attempt at opening the database.
 *
 * The timeout must not simply walk away from the request: the browser carries
 * on opening, and the connection it eventually hands over would be held by
 * nobody and closed by nobody. Every later attempt then contends with that
 * orphan, which is why a single slow start used to poison the whole session.
 */
const openOnce = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Whatever arrives later belongs to no one — close it on arrival.
      request.onsuccess = (event: any) => { try { event.target.result.close(); } catch { /* ignore */ } };
      reject(Object.assign(new Error('timeout'), { kind: 'timeout' }));
    }, OPEN_TIMEOUT_MS);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_DEVICES))   db.createObjectStore(STORE_DEVICES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_TASKS))     db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_INVOICES))  db.createObjectStore(STORE_INVOICES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_AUDIT))     db.createObjectStore(STORE_AUDIT, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_DELETIONS)) db.createObjectStore(STORE_DELETIONS, { keyPath: 'id' });
      // Documents fetched from Storage, so they stay readable without signal
      if (!db.objectStoreNames.contains(STORE_BLOBS))     db.createObjectStore(STORE_BLOBS);
      // v8: dosarul achizitiei — referatul si documentele care il sustin
      if (!db.objectStoreNames.contains(STORE_REFERATE))     db.createObjectStore(STORE_REFERATE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_FUNDAMENTARE)) db.createObjectStore(STORE_FUNDAMENTARE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_COMENZI)) db.createObjectStore(STORE_COMENZI, { keyPath: 'id' });
    };

    // Another window still holds an older version. Waiting for the timeout
    // here only delays a message the user could act on straight away.
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.onsuccess = (event: any) => { try { event.target.result.close(); } catch { /* ignore */ } };
      reject(Object.assign(new Error('blocked'), { kind: 'blocked' }));
    };

    request.onsuccess = (event: any) => {
      if (settled) { try { event.target.result.close(); } catch { /* ignore */ } return; }
      settled = true;
      clearTimeout(timer);
      const db: IDBDatabase = event.target.result;

      // Another tab is upgrading: let go, and forget the handle. Keeping the
      // resolved promise would hand every later write a closed connection.
      db.onversionchange = () => {
        try { db.close(); } catch { /* ignore */ }
        if (dbPromise) dbPromise = null;
      };
      db.onclose = () => { dbPromise = null; };

      resolve(db);
    };

    request.onerror = (event: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(Object.assign(event.target.error || new Error('error'), { kind: 'error' }));
    };
  });

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    try {
      const db = await openOnce();
      setProblem(null);
      return db;
    } catch (first: any) {
      // A phone waking the browser up can be slow enough to miss the first
      // attempt; a second one usually lands.
      if (first?.kind === 'timeout') {
        try {
          const db = await openOnce();
          setProblem(null);
          return db;
        } catch { /* fall through to the report below */ }
      }
      dbPromise = null;
      const problem: StorageProblem =
        first?.kind === 'blocked'
          ? { kind: 'blocked', message: 'Aplicatia e deschisa si in alta fereastra. Inchide-o si reincarca.' }
          : first?.kind === 'timeout'
            ? { kind: 'timeout', message: 'Baza de date locala nu raspunde. Reincarca aplicatia.' }
            : { kind: 'error', message: `Baza de date locala nu a putut fi deschisa: ${first?.message || first}` };
      setProblem(problem);
      throw Object.assign(new Error(problem.message), { kind: problem.kind });
    }
  })();

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

/*
 * Referate si documente de fundamentare — aceleasi trei operatii ca la
 * facturi, pe store-urile lor.
 */
const salveaza = <T extends { id: string }>(store: string, items: T[]): Promise<void> =>
  initDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const it of items) os.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));

const sterge = (store: string, id: string): Promise<void> =>
  initDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));

const citesteTot = <T>(store: string): Promise<T[]> =>
  initDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));

export const saveReferateToDB = (r: Referat[]) => salveaza(STORE_REFERATE, r);
export const deleteReferatFromDB = (id: string) => sterge(STORE_REFERATE, id);
export const getAllReferateFromDB = () => citesteTot<Referat>(STORE_REFERATE);

export const saveFoundationDocsToDB = (d: FoundationDoc[]) => salveaza(STORE_FUNDAMENTARE, d);
export const deleteFoundationDocFromDB = (id: string) => sterge(STORE_FUNDAMENTARE, id);
export const getAllFoundationDocsFromDB = () => citesteTot<FoundationDoc>(STORE_FUNDAMENTARE);

export const saveComenziToDB = (c: Comanda[]) => salveaza(STORE_COMENZI, c);
export const deleteComandaFromDB = (id: string) => sterge(STORE_COMENZI, id);
export const getAllComenziFromDB = () => citesteTot<Comanda>(STORE_COMENZI);

export const saveAuditToDB = async (entries: AuditEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_AUDIT, 'readwrite');
    const store = transaction.objectStore(STORE_AUDIT);
    for (const entry of entries) {
      store.put(entry);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const getAllAuditFromDB = async (): Promise<AuditEntry[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_AUDIT, 'readonly');
    const store = transaction.objectStore(STORE_AUDIT);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const saveDeletionsToDB = async (entries: Deletion[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DELETIONS, 'readwrite');
    const store = transaction.objectStore(STORE_DELETIONS);
    for (const entry of entries) store.put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event: any) => reject(event.target.error);
  });
};

export const getAllDeletionsFromDB = async (): Promise<Deletion[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_DELETIONS, 'readonly');
    const store = transaction.objectStore(STORE_DELETIONS);
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

/* ── Local copies of files kept in Supabase Storage ─────────────────────── */

export const cacheBlob = async (path: string, blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).put(blob, path);
    tx.oncomplete = () => resolve();
    tx.onerror = (event: any) => reject(event.target.error);
  });
};

export const getCachedBlob = async (path: string): Promise<Blob | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const request = tx.objectStore(STORE_BLOBS).get(path);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteCachedBlob = async (path: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).delete(path);
    tx.oncomplete = () => resolve();
    tx.onerror = (event: any) => reject(event.target.error);
  });
};

export const getCachedFileStats = async (): Promise<{ count: number }> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const request = tx.objectStore(STORE_BLOBS).count();
    request.onsuccess = () => resolve({ count: request.result });
    request.onerror = () => resolve({ count: 0 });
  });
};
