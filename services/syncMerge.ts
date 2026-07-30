
import { MedicalDevice } from '../types';

/** Collections that only ever grow — losing an entry means losing a document. */
const ADDITIVE_KEYS = ['files', 'maintenanceHistory', 'contracts', 'components'] as const;

const timeOf = (d?: { updated_at?: string }): number =>
  d?.updated_at ? new Date(d.updated_at).getTime() : 0;

/** Union of two lists keyed by `id`, preserving order and preferring `a`. */
const unionById = (a: any[] = [], b: any[] = []): any[] => {
  const seen = new Map<string, any>();
  [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].forEach(item => {
    const key = String(item?.id ?? JSON.stringify(item));
    if (!seen.has(key)) seen.set(key, item);
  });
  return [...seen.values()];
};

/**
 * Combines the local and cloud copy of one device.
 *
 * Scalar fields follow the newer `updated_at`, but attachments, service history,
 * contracts and components are merged rather than replaced. A record edited on
 * one phone must never delete a document scanned on another — which is exactly
 * what a whole-record overwrite does.
 */
export const mergeDeviceRecords = (
  local: MedicalDevice | undefined,
  cloud: MedicalDevice | undefined,
): MedicalDevice => {
  if (!local) return cloud as MedicalDevice;
  if (!cloud) return local;

  const localIsNewer = timeOf(local) >= timeOf(cloud);
  const base = localIsNewer ? local : cloud;
  const other = localIsNewer ? cloud : local;

  const merged: any = { ...base };
  ADDITIVE_KEYS.forEach(key => {
    merged[key] = unionById((base as any)[key], (other as any)[key]);
  });
  return merged as MedicalDevice;
};

/**
 * Decides what actually needs uploading.
 *
 * Rows identical to the cloud copy are skipped, and a row is only sent when it
 * is new or genuinely differs — after merging, so an upload can never strip
 * documents the cloud already holds.
 */
export const buildUploadSet = (
  localDevices: MedicalDevice[],
  cloudDevices: MedicalDevice[],
): MedicalDevice[] => {
  const cloudById = new Map(cloudDevices.map(d => [String(d.id).trim(), d]));
  const toUpload: MedicalDevice[] = [];

  for (const local of localDevices) {
    const cloud = cloudById.get(String(local.id).trim());
    if (!cloud) { toUpload.push(local); continue; }

    const merged = mergeDeviceRecords(local, cloud);
    const cloudCount = ADDITIVE_KEYS.reduce((n, k) => n + ((cloud as any)[k]?.length || 0), 0);
    const mergedCount = ADDITIVE_KEYS.reduce((n, k) => n + ((merged as any)[k]?.length || 0), 0);

    // Send when we hold newer edits, or when merging would add something the
    // cloud is missing. Otherwise leave the cloud copy alone.
    if (timeOf(local) > timeOf(cloud) || mergedCount > cloudCount) {
      toUpload.push(merged);
    }
  }
  return toUpload;
};
