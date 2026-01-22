
import { get, set, del, clear, entries } from 'idb-keyval';

// --- Image Storage (IndexedDB) ---

export const saveImage = async (id: string, file: File | Blob): Promise<void> => {
  try {
    await set(`map_${id}`, file);
  } catch (err) {
    console.error('IndexedDB Save Error:', err);
    throw err;
  }
};

export const getImage = async (id: string): Promise<Blob | undefined> => {
  try {
    return await get(`map_${id}`);
  } catch (err) {
    console.error('IndexedDB Get Error:', err);
    return undefined;
  }
};

export const removeImage = async (id: string): Promise<void> => {
  try {
    await del(`map_${id}`);
  } catch (err) {
    console.error('IndexedDB Remove Error:', err);
  }
};

export const clearAllImages = async (): Promise<void> => {
  try {
    await clear();
    console.log('IndexedDB Cleared');
  } catch (err) {
    console.error('IndexedDB Clear Error:', err);
  }
};

// --- Export/Import Helpers ---

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
  const res = await fetch(base64);
  return res.blob();
};

export interface ProjectData {
  version: string;
  timestamp: number;
  topology: any;
  site: any;
  images: Record<string, string>; // mapId -> base64
}

export const exportProject = async (topologyState: any, siteState: any): Promise<ProjectData> => {
  const images: Record<string, string> = {};

  // Find all mapIds in the site state
  if (siteState && siteState.buildings) {
    for (const building of siteState.buildings) {
      for (const floor of building.floors) {
        if (floor.mapId) {
          const blob = await getImage(floor.mapId);
          if (blob) {
            images[floor.mapId] = await blobToBase64(blob);
          }
        }
      }
    }
  }

  return {
    version: '1.0',
    timestamp: Date.now(),
    topology: topologyState,
    site: siteState,
    images
  };
};

export const importProject = async (jsonString: string) => {
  try {
    const data: ProjectData = JSON.parse(jsonString);
    
    // 1. Restore Images
    if (data.images) {
      await clearAllImages(); // Clear existing session first
      for (const [id, base64] of Object.entries(data.images)) {
        const blob = await base64ToBlob(base64);
        await saveImage(id, blob);
      }
    }

    return {
      topology: data.topology,
      site: data.site
    };
  } catch (e) {
    console.error("Import Failed", e);
    throw new Error("Invalid Project File");
  }
};
