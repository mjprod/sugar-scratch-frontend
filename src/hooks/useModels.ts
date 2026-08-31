import { useEffect, useState } from "react";
import { loadModels, type BackendModel } from "@/services/models";

/** Cached `/api/models` list for swapping local tile copy with CMS fields. */
export function useModels() {
  const [models, setModels] = useState<BackendModel[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadModels()
      .then((loaded) => {
        if (!cancelled) setModels(loaded);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return models;
}
