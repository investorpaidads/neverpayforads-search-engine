"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { getBankLogo } from "@/lib/bank-logos";

declare const google: any;

type Card = {
  id: number;
  card_number: string;
  cardholder_name: string;
  bank_name: string;
  bank_logo: string | null;
  expiry_date: string | null;
  country_code: string | null;
  country_name: string | null;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default function Home() {
  const [filters, setFilters] = useState({
    country: "",
    state: "",
    cardNumber: "",
    bankName: "",
    cardholder: "",
  });
  const [data, setData] = useState<{ rows: Card[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ countries: string[]; states: string[] }>({ countries: [], states: [] });
  const [offset, setOffset] = useState(0);
  const limit = 100;
  const [showHeatmap, setShowHeatmap] = useState(false);

  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatmapRef = useRef<any>(null);
  const bankLogosRef = useRef<Record<string, string | null>>({});
  const logoLoadingRef = useRef<Set<string>>(new Set());

  const loader = useMemo(
    () =>
      new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        version: "weekly",
        libraries: ["visualization", "marker"],
      }),
    []
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    return p.toString();
  }, [filters, offset, limit]);

  // Fetch filtered data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/cards?${queryString}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [queryString]);

  // Fetch options for country/state dropdown
  useEffect(() => {
    const url = filters.country ? `/api/options?country=${encodeURIComponent(filters.country)}` : "/api/options";
    fetch(url)
      .then((res) => res.json())
      .then((d) => setOptions(d))
      .catch(() => {});
  }, [filters.country]);

  // Load missing bank logos
  useEffect(() => {
    const loadLogos = async () => {
      const toLoad: { bankName: string; cardId: number }[] = [];
      data.rows.forEach((card) => {
        const key = `${card.id}-${card.bank_name}`;
        if (!card.bank_logo && !bankLogosRef.current[key] && !logoLoadingRef.current.has(key)) {
          toLoad.push({ bankName: card.bank_name, cardId: card.id });
          logoLoadingRef.current.add(key);
        }
      });
      if (!toLoad.length) return;

      await Promise.all(
        toLoad.map(async ({ bankName, cardId }) => {
          try {
            const logo = await getBankLogo(bankName, null);
            const key = `${cardId}-${bankName}`;
            bankLogosRef.current[key] = logo;
          } catch {
            const key = `${cardId}-${bankName}`;
            bankLogosRef.current[key] = null;
          }
        })
      );
    };
    loadLogos();
  }, [data.rows]);

  // Map initialization + markers + heatmap
  useEffect(() => {
    let map: any;

    const initializeMap = async () => {
      await loader.load();
      const mapEl = document.getElementById(window.innerWidth >= 1024 ? "map-desktop" : "map-mobile");
      if (!mapEl) return;

      if (!mapRef.current) {
        map = new google.maps.Map(mapEl, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
        });
        mapRef.current = map;
      } else {
        map = mapRef.current;
      }

      // Clear old markers
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // Remove old heatmap
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }

      // Add new markers
      const points: any[] = [];
      data.rows.forEach((card) => {
        if (card.latitude && card.longitude) {
          const pos = { lat: card.latitude, lng: card.longitude };
          points.push(new google.maps.LatLng(card.latitude, card.longitude));

          const marker = new google.maps.Marker({
            position: pos,
            map,
            title: card.cardholder_name,
          });
          markersRef.current.push(marker);
        }
      });

      // Add heatmap if selected
      if (showHeatmap && points.length) {
        const heatmap = new google.maps.visualization.HeatmapLayer({
          data: points,
          map,
        });
        heatmapRef.current = heatmap;
      }

      // Adjust map bounds
      if (!points.length) {
        map.setCenter({ lat: 0, lng: 0 });
        map.setZoom(2);
      } else if (points.length === 1) {
        map.setCenter(points[0]);
        map.setZoom(10);
      } else {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        map.fitBounds(bounds);
      }
    };

    initializeMap();
  }, [data.rows, showHeatmap, loader]);

  const getCardLogo = (card: Card) => {
    const key = `${card.id}-${card.bank_name}`;
    return bankLogosRef.current[key] ?? card.bank_logo;
  };

  const onExportCsv = () => {
    const headers = [
      "bank_name",
      "card_number",
      "cardholder_name",
      "country_name",
      "state_name",
      "city",
      "expiry_date",
      "owner_email",
      "owner_phone",
    ];
    const lines = [headers.join(",")].concat(
      data.rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? "")).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasNext = offset + limit < data.total;
  const hasPrev = offset > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Map */}
      <div id="map-desktop" className="w-full h-[500px]" />

      {/* Controls */}
      <div className="p-4 flex gap-4 flex-wrap items-center">
        <input
          placeholder="Country"
          value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          placeholder="State"
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          placeholder="Bank Name"
          value={filters.bankName}
          onChange={(e) => setFilters({ ...filters, bankName: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          placeholder="Card Number"
          value={filters.cardNumber}
          onChange={(e) => setFilters({ ...filters, cardNumber: e.target.value })}
          className="border p-2 rounded font-mono"
        />
        <input
          placeholder="Cardholder"
          value={filters.cardholder}
          onChange={(e) => setFilters({ ...filters, cardholder: e.target.value })}
          className="border p-2 rounded"
        />
        <button onClick={() => setShowHeatmap((prev) => !prev)} className="px-3 py-2 bg-blue-500 text-white rounded">
          Toggle Heatmap
        </button>
        <button onClick={onExportCsv} className="px-3 py-2 bg-green-500 text-white rounded">
          Export CSV
        </button>
      </div>

      {/* Records summary */}
      <div className="p-4 text-gray-600">
        {loading ? "Loading..." : `Showing ${offset + 1}-${Math.min(offset + limit, data.total)} of ${data.total} records`}
      </div>
    </div>
  );
}
