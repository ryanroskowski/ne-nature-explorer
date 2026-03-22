"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/maplibre";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { NatureArea, SpeciesIndexData } from "@/lib/types";
import { useAreaSpecies } from "@/lib/useAreaSpecies";
import AreaDetailPanel from "./AreaDetailPanel";
import MapFilters from "./MapFilters";

interface NatureMapProps {
  areas: NatureArea[];
  speciesIndex: SpeciesIndexData | null;
}

// Defaults — centered on all New England
const DEFAULT_LNG = -71.5;
const DEFAULT_LAT = 43.5;
const DEFAULT_ZOOM = 7;
const DEFAULT_FILTERS = {
  state: "all",
  ownerType: "all",
  minAcres: 0,
  minSpecies: 50,
  search: "",
};

// Parse map state from URL search params
function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    lng: parseFloat(params.get("lng") || "") || DEFAULT_LNG,
    lat: parseFloat(params.get("lat") || "") || DEFAULT_LAT,
    zoom: parseFloat(params.get("z") || "") || DEFAULT_ZOOM,
    areaId: params.get("area") || null,
    filters: {
      state: params.get("state") || DEFAULT_FILTERS.state,
      ownerType: params.get("owner") || DEFAULT_FILTERS.ownerType,
      minAcres: parseInt(params.get("acres") || "0", 10) || DEFAULT_FILTERS.minAcres,
      minSpecies: parseInt(params.get("species") || "", 10),
      search: params.get("q") || DEFAULT_FILTERS.search,
    },
  };
}

// Write current state to URL (replaceState — no new history entry)
function syncToUrl(
  viewport: { lng: number; lat: number; zoom: number },
  areaId: string | null,
  filters: typeof DEFAULT_FILTERS
) {
  const url = new URL(window.location.href);
  const p = url.searchParams;

  // Viewport — omit defaults
  if (Math.abs(viewport.lng - DEFAULT_LNG) > 0.01) p.set("lng", viewport.lng.toFixed(4));
  else p.delete("lng");
  if (Math.abs(viewport.lat - DEFAULT_LAT) > 0.01) p.set("lat", viewport.lat.toFixed(4));
  else p.delete("lat");
  if (Math.abs(viewport.zoom - DEFAULT_ZOOM) > 0.3) p.set("z", viewport.zoom.toFixed(1));
  else p.delete("z");

  // Area
  if (areaId) p.set("area", areaId);
  else p.delete("area");

  // Filters — omit defaults
  if (filters.state !== "all") p.set("state", filters.state);
  else p.delete("state");
  if (filters.ownerType !== "all") p.set("owner", filters.ownerType);
  else p.delete("owner");
  if (filters.minAcres > 0) p.set("acres", String(filters.minAcres));
  else p.delete("acres");
  if (filters.minSpecies !== 50) p.set("species", String(filters.minSpecies));
  else p.delete("species");
  if (filters.search) p.set("q", filters.search);
  else p.delete("q");

  window.history.replaceState({}, "", url.toString());
}

// Owner type → color mapping
const OWNER_COLORS: Record<string, string> = {
  state: "#2d6a4f",
  federal: "#5e548e",
  nonprofit: "#2176ae",
  municipal: "#c77c37",
  other: "#6b7280",
};

const OWNER_COLORS_LIGHT: Record<string, string> = {
  state: "rgba(45,106,79,0.15)",
  federal: "rgba(94,84,142,0.15)",
  nonprofit: "rgba(33,118,174,0.15)",
  municipal: "rgba(199,124,55,0.15)",
  other: "rgba(107,114,128,0.15)",
};

export default function NatureMap({ areas, speciesIndex }: NatureMapProps) {
  const mapRef = useRef<MapRef>(null);
  const hoveredFeatureId = useRef<number | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Parse initial state from URL
  const initialUrlState = useRef<ReturnType<typeof parseUrlState> | null>(null);
  if (initialUrlState.current === null && typeof window !== "undefined") {
    initialUrlState.current = parseUrlState();
  }
  const urlState = initialUrlState.current;

  const viewportRef = useRef({
    lng: urlState?.lng ?? DEFAULT_LNG,
    lat: urlState?.lat ?? DEFAULT_LAT,
    zoom: urlState?.zoom ?? DEFAULT_ZOOM,
  });

  const [selectedArea, setSelectedArea] = useState<NatureArea | null>(() => {
    if (urlState?.areaId) {
      return areas.find((a) => a.id === urlState.areaId) ?? null;
    }
    return null;
  });

  const [filters, setFilters] = useState(() => {
    if (urlState) {
      return {
        ...DEFAULT_FILTERS,
        ...urlState.filters,
        // Handle NaN from parseInt
        minSpecies: isNaN(urlState.filters.minSpecies) ? DEFAULT_FILTERS.minSpecies : urlState.filters.minSpecies,
      };
    }
    return DEFAULT_FILTERS;
  });

  // Track initial viewport for the Map component
  const initialViewState = useMemo(() => ({
    longitude: urlState?.lng ?? DEFAULT_LNG,
    latitude: urlState?.lat ?? DEFAULT_LAT,
    zoom: urlState?.zoom ?? DEFAULT_ZOOM,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch per-area species data on demand when area is selected
  const { data: selectedAreaSpecies, loading: speciesLoading } = useAreaSpecies(
    selectedArea?.id ?? null
  );

  // Sync viewport to URL on map move (debounced)
  const handleMoveEnd = useCallback((evt: ViewStateChangeEvent) => {
    const { longitude, latitude, zoom } = evt.viewState;
    viewportRef.current = { lng: longitude, lat: latitude, zoom };
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncToUrl(viewportRef.current, selectedArea?.id ?? null, filters);
    }, 500);
  }, [selectedArea, filters]);

  // Sync area selection to URL via pushState (creates history entry)
  const selectArea = useCallback((area: NatureArea | null) => {
    setSelectedArea(area);
    const url = new URL(window.location.href);
    if (area) url.searchParams.set("area", area.id);
    else url.searchParams.delete("area");
    window.history.pushState({}, "", url.toString());
  }, []);

  // Sync filters to URL
  useEffect(() => {
    syncToUrl(viewportRef.current, selectedArea?.id ?? null, filters);
  }, [filters, selectedArea]);

  // Handle browser back/forward for area changes
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const areaId = params.get("area");
      setSelectedArea(areaId ? areas.find((a) => a.id === areaId) ?? null : null);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [areas]);

  // Filter areas using lightweight index
  const filteredAreas = useMemo(() => {
    return areas.filter((a) => {
      if (filters.state !== "all" && a.state !== filters.state)
        return false;
      if (filters.ownerType !== "all" && a.ownerType !== filters.ownerType)
        return false;
      if (a.acreage < filters.minAcres) return false;
      if (filters.minSpecies > 0) {
        const speciesCount = speciesIndex?.areaSpecies?.[a.id]?.speciesFound || 0;
        if (speciesCount < filters.minSpecies) return false;
      }
      if (
        filters.search &&
        !a.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !a.owner.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [areas, filters, speciesIndex]);

  // Build GeoJSON for polygons
  const polygonGeoJSON = useMemo(() => {
    const features = filteredAreas
      .filter((a) => a.geometry)
      .map((a, i) => ({
        type: "Feature" as const,
        id: i,
        properties: {
          _idx: i,
          id: a.id,
          name: a.name,
          owner: a.owner,
          ownerType: a.ownerType,
          acreage: a.acreage,
          purpose: a.purpose,
        },
        geometry: a.geometry!,
      }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [filteredAreas]);

  // Build GeoJSON for centroids (for labels/clustering)
  const centroidGeoJSON = useMemo(() => {
    const features = filteredAreas.map((a) => ({
      type: "Feature" as const,
      properties: {
        id: a.id,
        name: a.name,
        owner: a.owner,
        ownerType: a.ownerType,
        acreage: a.acreage,
        speciesCount:
          speciesIndex?.areaSpecies?.[a.id]?.speciesFound || 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: a.centroid,
      },
    }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [filteredAreas, speciesIndex]);

  const handleMapClick = useCallback(
    (e: any) => {
      const features = e.features;
      if (features && features.length > 0) {
        const clickedId = features[0].properties.id;
        const area = areas.find((a) => a.id === clickedId);
        if (area) {
          selectArea(area);
          return;
        }
      }
      // Click on empty space: deselect
      selectArea(null);
    },
    [areas, selectArea]
  );

  // Attach native MapLibre hover events after map loads — avoids
  // react-map-gl re-render flicker and "source not found" errors
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    map.on("mousemove", "area-fill", (e) => {
      if (e.features && e.features.length > 0) {
        // Clear previous
        if (hoveredFeatureId.current !== null) {
          map.setFeatureState(
            { source: "area-polygons", id: hoveredFeatureId.current },
            { hover: false }
          );
        }
        hoveredFeatureId.current = e.features[0].id as number;
        map.setFeatureState(
          { source: "area-polygons", id: hoveredFeatureId.current },
          { hover: true }
        );
        map.getCanvas().style.cursor = "pointer";
      }
    });

    map.on("mouseleave", "area-fill", () => {
      if (hoveredFeatureId.current !== null) {
        map.setFeatureState(
          { source: "area-polygons", id: hoveredFeatureId.current },
          { hover: false }
        );
        hoveredFeatureId.current = null;
      }
      map.getCanvas().style.cursor = "grab";
    });
  }, []);

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 64px)" }}>
      {/* Filter bar */}
      <MapFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalAreas={filteredAreas.length}
        areas={areas}
        onSelectArea={(area) => {
          selectArea(area);
          const map = mapRef.current?.getMap();
          if (map && area.bbox) {
            map.fitBounds(
              [[area.bbox[0], area.bbox[1]], [area.bbox[2], area.bbox[3]]],
              { padding: 100, maxZoom: 15, duration: 1500 }
            );
          } else if (map && area.centroid) {
            map.flyTo({
              center: area.centroid as [number, number],
              zoom: 14,
              duration: 1500,
            });
          }
        }}
      />

      {/* Map */}
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        onMoveEnd={handleMoveEnd}
        style={{ width: "100%", height: "100%" }}
        mapStyle={{
          version: 8,
          name: "Nature Map",
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
          },
          layers: [
            {
              id: "osm-tiles",
              type: "raster",
              source: "osm",
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        }}
        interactiveLayerIds={["area-fill", "area-centroids"]}
        onClick={handleMapClick}
        onLoad={onMapLoad}
        cursor="grab"
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {/* Area polygons */}
        <Source id="area-polygons" type="geojson" data={polygonGeoJSON} promoteId="_idx">
          <Layer
            id="area-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match",
                ["get", "ownerType"],
                "state", OWNER_COLORS_LIGHT.state,
                "federal", OWNER_COLORS_LIGHT.federal,
                "nonprofit", OWNER_COLORS_LIGHT.nonprofit,
                "municipal", OWNER_COLORS_LIGHT.municipal,
                OWNER_COLORS_LIGHT.other,
              ],
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.5,
                0.3,
              ],
            }}
            minzoom={10}
          />
          <Layer
            id="area-outline"
            type="line"
            paint={{
              "line-color": [
                "match",
                ["get", "ownerType"],
                "state", OWNER_COLORS.state,
                "federal", OWNER_COLORS.federal,
                "nonprofit", OWNER_COLORS.nonprofit,
                "municipal", OWNER_COLORS.municipal,
                OWNER_COLORS.other,
              ],
              "line-width": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                3,
                1.5,
              ],
            }}
            minzoom={10}
          />
        </Source>

        {/* Centroid markers (clustered at low zoom) */}
        <Source
          id="area-centroids"
          type="geojson"
          data={centroidGeoJSON}
          cluster={true}
          clusterMaxZoom={12}
          clusterRadius={50}
        >
          {/* Cluster circles */}
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": "#2d6a4f",
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16, 10,
                20, 50,
                24, 100,
                28,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            }}
            paint={{
              "text-color": "#fff",
            }}
          />

          {/* Individual markers */}
          <Layer
            id="area-centroids"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": [
                "match",
                ["get", "ownerType"],
                "state", OWNER_COLORS.state,
                "federal", OWNER_COLORS.federal,
                "nonprofit", OWNER_COLORS.nonprofit,
                "municipal", OWNER_COLORS.municipal,
                OWNER_COLORS.other,
              ],
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                8, 4,
                12, 7,
                15, 10,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
            maxzoom={15}
          />

          {/* Labels at high zoom */}
          <Layer
            id="area-labels"
            type="symbol"
            filter={["!", ["has", "point_count"]]}
            layout={{
              "text-field": ["get", "name"],
              "text-size": 11,
              "text-offset": [0, 1.5],
              "text-anchor": "top",
              "text-max-width": 12,
            }}
            paint={{
              "text-color": "#1a1a1a",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1.5,
            }}
            minzoom={12}
          />
        </Source>
      </Map>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-md text-xs z-10">
        <div className="font-semibold mb-1.5 text-text-primary">Owner Type</div>
        {Object.entries({
          state: "State",
          federal: "Federal",
          nonprofit: "Nonprofit",
          municipal: "Municipal",
        }).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 mb-0.5">
            <span
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: OWNER_COLORS[key] }}
            />
            <span className="text-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Area detail panel */}
      {selectedArea && (
        <AreaDetailPanel
          area={selectedArea}
          speciesData={selectedAreaSpecies}
          loading={speciesLoading}
          onClose={() => selectArea(null)}
        />
      )}
    </div>
  );
}
