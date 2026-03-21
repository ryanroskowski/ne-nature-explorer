"use client";

import { useState, useEffect } from "react";
import type { AreaSpeciesData } from "./types";

const cache = new Map<string, AreaSpeciesData>();

export function useAreaSpecies(areaId: string | null) {
  const [data, setData] = useState<AreaSpeciesData | null>(
    areaId ? cache.get(areaId) ?? null : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Already cached
    const cached = cache.get(areaId);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setData(null);

    fetch(`/area-species/${areaId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((json: AreaSpeciesData) => {
        cache.set(areaId, json);
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  return { data, loading };
}
