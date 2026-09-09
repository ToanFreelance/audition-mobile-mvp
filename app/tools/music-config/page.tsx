"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuditionGauge from "../../../components/AuditionGauge";
import WaveformPlayer, { type WaveformMarker, type WaveformPlayerHandle } from "../../../components/WaveformPlayer";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { analyzeTempo, type TempoAnalysis } from "../../../game/tempo-analysis";
import "./music-config.css";
import "./music-config-overrides.css";

type Theme = "dark" | "light";
type AudioAsset = { path: string; name: string; url: string; size?: number; updatedAt?: string };
type LibraryResponse = { configs: MusicConfig[]; storage: AudioAsset[] };
type MusicConfigApiResponse = { config?: MusicConfig; error?: string; detail?: string };
type UploadProgress = { done: number; total: number; failed: number };

const BATCH_QUEUE_KEY = "audition-rhythm-batch-assets";

const cloneDefault = (overrides: Partial<MusicConfig> = {}): MusicConfig => ({
  ...DEFAULT_MUSIC_CONFIG,
  BPM_exact: DEFAULT_MUSIC_CONFIG.BPM_exact,
  ...overrides,
});

const createDraft = (overrides: Partial<MusicConfig> = {}): MusicConfig => cloneDefault({
  id: "draft",
  title: "",
  artist: "",
  audioUrl: "",
  durationMs: 0,
  bpm: 0,
  BPM_exact: undefined,
  referenceBpm: undefined,
  referenceSource: undefined,
  spaceStartMs: 0,
  spaceStartBeat: undefined,
  notes: "",
  updatedAt: "",
  ...overrides,
});

const formatTime = (ms: number, precision = 3) => {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : `chart-${Date.now()}`;

const titleFromAsset = (asset: AudioAsset) => asset.name.replace(/\.[^/.]+$/, "");

export default function MusicConfigPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformRef = useRef<WaveformPlayerHandle | null>(null);
  const audioDockRef = useRef<HTMLDivElement | null>(null);
  const stickyActionsRef = useRef<HTMLElement | null>(null);

  const [config, setConfig] = useState<MusicConfig>(() => createDraft());
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<AudioAsset[]>([]);
  const [analysis, setAnalysis] = useState<TempoAnalysis | null>(null);
  const [selectedAnchorMs, setSelectedAnchorMs] = useState<number | null>(null);
  const [usedAnchorMs, setUsedAnchorMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dockExpanded, setDockExpanded] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ done: 0, total: 0, failed: 0 });
  const [assetSearch, setAssetSearch] = useState("");
  const [selectedAssetPaths, setSelectedAssetPaths] = useState<Set<string>>(new Set());
  const [editorAssetPath, setEditorAssetPath] = useState<string | null>(null);
  const [fixedStackHeight, setFixedStackHeight] = useState(0);
  const [previewingAnchorMs, setPreviewingAnchorMs] = useState<number | null>(null);
  const [deletingStoragePath, setDeletingStoragePath] = useState<string | null>(null);
  const [deletingChartId, setDeletingChartId] = useState<string | null>(null);

  const isDark = theme === "dark";
  const panelClass = isDark
    ? "border-white/10 bg-slate-950/70 shadow-2xl shadow-black/20"
    : "border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-violet-500/30 ${isDark ? "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-600" : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"}`;
  const buttonBase = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-extrabold tracking-wide transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35";
  const buttonClass = `${buttonBase} ${isDark ? "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  const primaryButtonClass = `${buttonBase} border-violet-400/70 bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-violet-600/20 hover:brightness-110`;

  const patch = useCallback(<K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }));
  }, []);

  const fetchLibraries = useCallback(async (): Promise<LibraryResponse> => {
    const [configsResponse, storageResponse] = await Promise.all([
      fetch("/api/music-config", { cache: "no-store" }),
      fetch("/api/music-library", { cache: "no-store" }),
    ]);
    const configsJson = await configsResponse.json().catch(() => ({}));
    const storageJson = await storageResponse.json().catch(() => ({}));
    if (!configsResponse.ok) throw new Error(configsJson.detail || configsJson.error || `Music config HTTP ${configsResponse.status}`);
    if (!storageResponse.ok) throw new Error(storageJson.detail || storageJson.error || `Music library HTTP ${storageResponse.status}`);
    return {
      configs: Array.isArray(configsJson) ? configsJson : configsJson.configs ?? [],
      storage: Array.isArray(storageJson.files)
        ? storageJson.files.map((item: { name?: string; publicUrl?: string; url?: string; updatedAt?: string; size?: number }) => ({
            path: item.name ?? "",
            name: item.name ?? "",
            url: item.publicUrl ?? item.url ?? "",
            updatedAt: item.updatedAt,
            size: item.size,
          }))
        : [],
    };
  }, []);

  const loadConfig = useCallback((nextConfig: MusicConfig) => {
    setConfig({ ...nextConfig });
    setAnalysis(null);
    setSelectedAnchorMs(nextConfig.spaceStartMs > 0 ? nextConfig.spaceStartMs : null);
    setUsedAnchorMs(nextConfig.spaceStartMs > 0 ? nextConfig.spaceStartMs : null);
    setCurrentTimeMs(0);
    setAudioDurationMs(nextConfig.durationMs || 0);
    setPreviewingAnchorMs(null);
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchLibraries();
    setLibrary(data.configs);
    setStorageFiles(data.storage);
    return data;
  }, [fetchLibraries]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .then(data => {
        if (cancelled) return;
        loadConfig(data.configs[0] ?? createDraft());
      })
      .catch(error => {
        if (!cancelled) setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown error"}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refresh, loadConfig]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("audition-music-config-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("audition-music-config-theme", theme);
  }, [theme]);

  useEffect(() => {
    const dock = audioDockRef.current;
    const sticky = stickyActionsRef.current;
    if (!dock || !sticky) return;
    const measure = () => {
      if (window.innerWidth > 760) {
        setFixedStackHeight(0);
        return;
      }
      setFixedStackHeight(Math.ceil(dock.getBoundingClientRect().height + sticky.getBoundingClientRect().height + 18));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    observer.observe(sticky);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dockExpanded, config.audioUrl, analysis, theme, previewingAnchorMs, currentTimeMs]);

  const handleWaveTime = useCallback((ms: number) => setCurrentTimeMs(ms), []);
  const handleWaveDuration = useCallback((ms: number) => {
    setAudioDurationMs(ms);
    patch("durationMs", ms);
  }, [patch]);

  const chooseAsset = useCallback((asset: AudioAsset) => {
    const title = titleFromAsset(asset);
    loadConfig(createDraft({ id: makeId(), title, audioUrl: asset.url }));
    setAddOpen(false);
    setSelectedAssetPaths(new Set());
    setEditorAssetPath(asset.path);
    setMessage(`Selected ${asset.name}. Run Analyze Audio, choose Space Start, then save the chart.`);
  }, [loadConfig]);

  const openAudioLibrary = useCallback(() => {
    const current = storageFiles.find(asset => asset.url === config.audioUrl);
    setSelectedAssetPaths(new Set());
    setEditorAssetPath(current?.path ?? storageFiles[0]?.path ?? null);
    setAssetSearch("");
    setAddOpen(true);
  }, [config.audioUrl, storageFiles]);

  const toggleAsset = useCallback((path: string) => {
    setEditorAssetPath(path);
    setSelectedAssetPaths(current => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const uploadFiles = async (files: File[]) => {
    if (!files.length || uploading) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length, failed: 0 });
    const uploaded: AudioAsset[] = [];
    let failed = 0;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (!file) continue;
      setMessage(`Uploading ${index + 1}/${files.length}: ${file.name}…`);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/music-library", { method: "POST", body: form });
        const data = await response.json().catch(() => ({})) as { publicUrl?: string; name?: string; error?: string; detail?: string };
        if (!response.ok || !data.publicUrl) throw new Error(data.detail || data.error || `Upload HTTP ${response.status}`);
        const asset: AudioAsset = {
          path: data.name ?? file.name,
          name: data.name ?? file.name,
          url: data.publicUrl,
          size: file.size,
        };
        uploaded.push(asset);
        setStorageFiles(current => [asset, ...current.filter(item => item.path !== asset.path)]);
      } catch (error) {
        failed += 1;
        setMessage(`Upload ${index + 1}/${files.length} failed for ${file.name}: ${error instanceof Error ? error.message : "unknown error"}`);
      } finally {
        setUploadProgress({ done: index + 1, total: files.length, failed });
      }
    }

    setUploading(false);
    if (uploaded.length === 1 && files.length === 1 && failed === 0) {
      chooseAsset(uploaded[0]);
      return;
    }
    if (uploaded.length) {
      setSelectedAssetPaths(new Set(uploaded.map(asset => asset.path)));
      setEditorAssetPath(uploaded[0]?.path ?? null);
      setMessage(`Uploaded ${uploaded.length}/${files.length} audio files${failed ? ` · ${failed} failed` : ""}. Pick an editor target or analyze the selected batch.`);
    } else if (failed) {
      setMessage(`Upload failed for all ${files.length} files.`);
    }
  };

  const queueAssetsForBatch = useCallback((assets: AudioAsset[]) => {
    if (!assets.length) {
      window.sessionStorage.removeItem(BATCH_QUEUE_KEY);
    } else {
      window.sessionStorage.setItem(BATCH_QUEUE_KEY, JSON.stringify(assets.map(asset => ({
        path: asset.path,
        name: asset.name,
        url: asset.url,
        size: asset.size,
      }))));
    }
    window.location.href = "/tools/rhythm-benchmark/batch";
  }, []);

  const deleteStorageAsset = useCallback(async (asset: AudioAsset) => {
    if (deletingStoragePath || saving) return;
    const confirmed = window.confirm(`Delete “${asset.name}” permanently from Supabase Storage?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    const deleteLinkedCharts = window.confirm(
      `Also delete any Music Chart Library entry using “${asset.name}”?\n\nOK = delete Storage + linked Library chart(s)\nCancel = delete Storage only and keep the chart entry.`,
    );

    setDeletingStoragePath(asset.path);
    setMessage(deleteLinkedCharts
      ? `Deleting ${asset.name} from Storage and linked chart(s)…`
      : `Deleting ${asset.name} from Storage only…`);

    try {
      const response = await fetch("/api/music-library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: asset.path, deleteLinkedCharts }),
      });
      const data = await response.json().catch(() => ({})) as {
        error?: string;
        detail?: string;
        deletedCharts?: number;
      };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);

      setSelectedAssetPaths(current => {
        const next = new Set(current);
        next.delete(asset.path);
        return next;
      });
      setEditorAssetPath(current => current === asset.path ? null : current);

      const refreshed = await refresh();
      if (deleteLinkedCharts && config.audioUrl === asset.url) {
        loadConfig(refreshed.configs[0] ?? createDraft());
      }

      setMessage(deleteLinkedCharts
        ? `Deleted ${asset.name} from Storage${data.deletedCharts ? ` and ${data.deletedCharts} linked chart${data.deletedCharts === 1 ? "" : "s"}` : " and linked Library data"}.`
        : `Deleted ${asset.name} from Storage. Library chart was kept by your choice.`);
    } catch (error) {
      setMessage(`Audio delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setDeletingStoragePath(null);
    }
  }, [config.audioUrl, deletingStoragePath, loadConfig, refresh, saving]);

  const deleteChart = useCallback(async (track: MusicConfig) => {
    if (!track.id || deletingChartId || saving) return;
    if (!window.confirm(`Delete chart “${track.title}” from Music Chart Library?\n\nThe audio file will remain in Supabase Storage.`)) return;

    setDeletingChartId(track.id);
    setSaving(true);
    setMessage(`Deleting chart ${track.title}…`);
    try {
      const response = await fetch(`/api/music-config?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await refresh();
      if (config.id === track.id) {
        loadConfig(refreshed.configs[0] ?? createDraft());
      }
      setMessage(`Deleted chart “${track.title}”. Audio asset retained in Storage.`);
    } catch (error) {
      setMessage(`Delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setDeletingChartId(null);
      setSaving(false);
    }
  }, [config.id, deletingChartId, loadConfig, refresh, saving]);

  const analyze = async () => {
    if (!config.audioUrl || analyzing || analysis) return;
    setAnalyzing(true);
    setMessage("Analyzing tempo, audio start and beat positions…");
    try {
      const result = await analyzeTempo(config.audioUrl, config.spaceStartMs);
      setAnalysis(result);
      patch("bpm", result.displayBpm);
      patch("BPM_exact", result.bpmExact);
      const firstAnchor = config.spaceStartMs > 0
        ? config.spaceStartMs
        : (result.beats[0] !== undefined ? Math.round(result.beats[0] * 1000) : 0);
      setSelectedAnchorMs(firstAnchor > 0 ? firstAnchor : null);
      setUsedAnchorMs(config.spaceStartMs > 0 ? config.spaceStartMs : null);
      setMessage(`Detected ${result.bpmExact.toFixed(4)} BPM · audible begin ${formatTime(result.audioStartMs, 3)}.`);
    } catch (error) {
      setMessage(`Analysis failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const anchors = useMemo<WaveformMarker[]>(() => !analysis?.beats?.length
    ? []
    : analysis.beats
        .map((seconds, index) => ({ ms: Math.round(seconds * 1000), beatIndex: index + 1 }))
        .filter(anchor => anchor.beatIndex % 4 === 0)
        .slice(0, 32), [analysis]);

  const selectAnchor = (anchor: WaveformMarker) => {
    setSelectedAnchorMs(anchor.ms);
    setUsedAnchorMs(null);
    setPreviewingAnchorMs(null);
    setMessage(`Selected Beat ${anchor.beatIndex} at ${formatTime(anchor.ms, 3)}. Tap Use Anchor to apply.`);
  };

  const useAnchor = () => {
    const anchor = anchors.find(item => item.ms === selectedAnchorMs) ?? anchors[0];
    if (!anchor) {
      setMessage("Run analysis and select an anchor first.");
      return;
    }
    patch("spaceStartMs", anchor.ms);
    patch("spaceStartBeat", anchor.beatIndex);
    setSelectedAnchorMs(anchor.ms);
    setUsedAnchorMs(anchor.ms);
    setPreviewingAnchorMs(null);
    waveformRef.current?.seekTo(anchor.ms);
    setCurrentTimeMs(anchor.ms);
    setMessage(`✓ Space Start applied: Beat ${anchor.beatIndex} at ${formatTime(anchor.ms, 3)}.`);
  };

  const previewAnchor = (anchor: WaveformMarker) => {
    setSelectedAnchorMs(anchor.ms);
    setUsedAnchorMs(null);
    setPreviewingAnchorMs(anchor.ms);
    waveformRef.current?.previewFrom(Math.max(0, anchor.ms - 5000));
    setMessage(`Previewing 5s before Beat ${anchor.beatIndex}. Listen, then apply this anchor or use the current position.`);
  };

  const save = async () => {
    const exactBpm = config.BPM_exact;
    if (!config.audioUrl || !config.title.trim()) {
      setMessage("Title and audio are required.");
      return;
    }
    if (typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0) {
      setMessage("Run Analyze Audio before saving.");
      return;
    }
    if (saving) return;

    setSaving(true);
    setMessage("Saving chart configuration…");
    try {
      const payload = {
        ...config,
        bpm: Math.round(config.bpm),
        BPM_exact: Number(exactBpm.toFixed(4)),
        durationMs: audioDurationMs || config.durationMs,
      };
      const response = await fetch("/api/music-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as MusicConfigApiResponse;
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await refresh();
      if (data.config) loadConfig(data.config);
      else if (refreshed.configs.length) loadConfig(refreshed.configs[0]);
      setMessage("Chart saved to Library.");
    } catch (error) {
      setMessage(`Save failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const exactBpm = config.BPM_exact;
  const timingBpm = typeof exactBpm === "number" && Number.isFinite(exactBpm) && exactBpm > 0 ? exactBpm : config.bpm;
  const isExistingChart = Boolean(config.id && library.some(item => item.id === config.id));
  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    return query ? storageFiles.filter(file => file.name.toLowerCase().includes(query)) : storageFiles;
  }, [assetSearch, storageFiles]);
  const selectedAssets = useMemo(
    () => storageFiles.filter(asset => selectedAssetPaths.has(asset.path)),
    [storageFiles, selectedAssetPaths],
  );
  const editorAsset = useMemo(
    () => storageFiles.find(asset => asset.path === editorAssetPath) ?? null,
    [storageFiles, editorAssetPath],
  );
  const analyzeDisabled = loading || analyzing || Boolean(analysis) || !config.audioUrl;
  const analyzeLabel = analyzing ? "ANALYZING…" : analysis ? "ANALYZED" : "ANALYZE AUDIO";
  const anchorApplied = selectedAnchorMs != null && usedAnchorMs === selectedAnchorMs;
  const referenceBpm = typeof config.referenceBpm === "number" && Number.isFinite(config.referenceBpm) && config.referenceBpm > 0
    ? config.referenceBpm
    : null;
  const referenceDurationMs = audioDurationMs || config.durationMs;
  const referenceDriftMs = referenceBpm != null && typeof exactBpm === "number" && exactBpm > 0 && referenceDurationMs > 0
    ? referenceDurationMs * (exactBpm / referenceBpm - 1)
    : null;
  const referencePlaybackRate = referenceBpm != null && typeof exactBpm === "number" && exactBpm > 0
    ? referenceBpm / exactBpm
    : null;
  const referenceStatus = referenceBpm == null
    ? "NO REFERENCE"
    : referenceDriftMs == null
      ? "AWAITING ANALYSIS"
      : Math.abs(referenceDriftMs) <= 30
        ? "MATCH"
        : "SOURCE SPEED MISMATCH";
  const bottomPadding = fixedStackHeight > 0 ? fixedStackHeight + 24 : dockExpanded ? 300 : 180;

  return (
    <main
      className={`min-h-screen overflow-x-hidden transition-colors ${isDark ? "bg-[#080a11] text-slate-100" : "bg-[#f5f6fa] text-slate-900"}`}
      style={{ paddingBottom: bottomPadding }}
    >
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
        onChange={event => {
          void uploadFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />

      <div className={`pointer-events-none fixed inset-0 -z-0 ${isDark ? "bg-[radial-gradient(circle_at_20%_-10%,rgba(139,92,246,.20),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(217,70,239,.10),transparent_30%)]" : "bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,.10),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(217,70,239,.08),transparent_28%)]"}`} />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Chart Studio</span>
              <span className={`text-xs font-semibold ${mutedClass}`}>{library.length} charts · {storageFiles.length} audio files</span>
            </div>
            <h1 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">Music Chart Studio</h1>
            <p className={`mt-1 max-w-2xl text-sm ${mutedClass}`}>Upload, analyze, author the first Space timing, then publish clean charts to the game library.</p>
          </div>
          <button className={buttonClass} onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} type="button">
            <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
            {isDark ? "LIGHT" : "DARK"}
          </button>
        </header>

        <section className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Music Charts</p>
              <h2 className="mt-1 text-xl font-black tracking-tight">Chart library</h2>
              <p className={`mt-1 text-xs ${mutedClass}`}>Only saved charts appear here. Audio files remain independently available in Storage.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button className={buttonClass} onClick={() => queueAssetsForBatch([])} type="button">
                <span aria-hidden="true">⚗</span> Analyze multiple
              </button>
              <button className={primaryButtonClass} onClick={openAudioLibrary} type="button">
                <span aria-hidden="true">＋</span> Add audio
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {library.map(track => {
              const active = track.id === config.id;
              const fileName = storageFiles.find(asset => asset.url === track.audioUrl)?.name || "Audio asset";
              return (
                <div
                  className={`group relative rounded-2xl border transition ${active ? "border-violet-400/70 bg-violet-500/10 ring-1 ring-violet-500/20" : isDark ? "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]" : "border-slate-200 bg-slate-50/80 hover:border-violet-200 hover:bg-violet-50/40"}`}
                  key={track.id}
                >
                  <button className="grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 p-3 pr-12 text-left" onClick={() => loadConfig(track)} type="button">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg text-white shadow-md shadow-violet-600/20" aria-hidden="true">♫</span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-extrabold">{track.title}</strong>
                      <span className={`mt-0.5 block truncate text-[11px] ${mutedClass}`}>{track.artist || "Unknown artist"} · {track.bpm || "—"} BPM</span>
                      <span className={`mt-1 block truncate font-mono text-[9px] ${mutedClass}`}>{fileName}</span>
                    </span>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-black ${typeof track.BPM_exact === "number" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {typeof track.BPM_exact === "number" ? `${track.BPM_exact.toFixed(2)} exact` : "needs analysis"}
                    </span>
                  </button>
                  <button
                    className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border text-sm transition disabled:opacity-40 ${isDark ? "border-rose-400/15 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15" : "border-rose-200 bg-white text-rose-500 hover:bg-rose-50"}`}
                    disabled={Boolean(deletingChartId) || saving}
                    onClick={() => void deleteChart(track)}
                    type="button"
                    aria-label={`Delete ${track.title} from chart library`}
                    title="Delete chart; keep audio in Storage"
                  >
                    {deletingChartId === track.id ? "…" : "×"}
                  </button>
                </div>
              );
            })}

            {!library.length && (
              <div className={`col-span-full rounded-2xl border border-dashed p-6 text-center ${isDark ? "border-white/10 bg-white/[0.02]" : "border-slate-300 bg-slate-50"}`}>
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-xl text-violet-400">♫</div>
                <h3 className="mt-3 text-sm font-extrabold">No saved charts yet</h3>
                <p className={`mx-auto mt-1 max-w-md text-xs ${mutedClass}`}>Your audio files are still in Supabase Storage. Choose one, analyze it, then save the finished chart.</p>
                <button className={`${primaryButtonClass} mt-4`} onClick={openAudioLibrary} type="button">＋ Choose audio</button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className={`rounded-2xl border p-4 sm:p-5 lg:col-span-2 ${panelClass}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-400">Chart Editor</p>
                <h2 className="mt-1 truncate text-xl font-black tracking-tight">{config.audioUrl ? (config.title || "Untitled track") : "Choose an audio file to start"}</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>{config.audioUrl ? (config.artist || "Add artist information in Chart Details.") : "Storage and Chart Library are separate, so deleting charts does not remove your audio files."}</p>
              </div>
              <div className="flex gap-2">
                {!config.audioUrl && <button className={buttonClass} onClick={openAudioLibrary} type="button">Choose audio</button>}
                <button className={primaryButtonClass} disabled={analyzeDisabled} onClick={() => void analyze()} type="button">{analyzeLabel}</button>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Tempo</p>
                <h3 className="mt-1 text-base font-extrabold">Detected timing</h3>
              </div>
              <div className="text-right">
                <strong className="block font-mono text-2xl font-black">{config.bpm > 0 ? config.bpm : "—"}</strong>
                <span className={`block text-[9px] font-bold uppercase tracking-wider ${mutedClass}`}>display BPM</span>
                <span className="mt-1 block font-mono text-[10px] font-bold text-violet-400">{typeof exactBpm === "number" ? exactBpm.toFixed(4) : "—"} exact</span>
              </div>
            </div>

            {analysis ? (
              <div className="mt-4 space-y-2">
                <p className={`rounded-xl border px-3 py-2 text-xs ${isDark ? "border-white/10 bg-white/[0.025] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>Analysis start {formatTime(analysis.audioStartMs, 3)} · choose a candidate only when you intentionally want to override the detector.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.candidates.map((candidate, index) => {
                    const selected = Math.abs(candidate.bpm - timingBpm) < 0.02 && candidate.source === "tempo";
                    return (
                      <button
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-violet-400/70 bg-violet-500/10" : isDark ? "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]" : "border-slate-200 bg-slate-50 hover:bg-violet-50"}`}
                        key={`${candidate.source}-${candidate.bpm}-${index}`}
                        onClick={() => {
                          patch("bpm", Math.round(candidate.bpm));
                          patch("BPM_exact", Number(candidate.bpm.toFixed(4)));
                        }}
                        type="button"
                      >
                        <span><strong className="font-mono text-sm">{candidate.bpm.toFixed(2)}</strong> <span className={`text-[10px] ${mutedClass}`}>BPM</span></span>
                        <small className={`text-[9px] ${mutedClass}`}>{candidate.source} · {(candidate.confidence * 100).toFixed(0)}%</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className={`mt-4 rounded-xl border border-dashed px-3 py-3 text-xs ${isDark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-500"}`}>{config.audioUrl ? "Run Analyze Audio to detect BPM and build candidate 4-beat anchors." : "Choose an audio file first."}</p>
            )}
          </div>

          <div className={`rounded-2xl border p-4 sm:p-5 ${panelClass}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-400">Phase</p>
                <h3 className="mt-1 text-base font-extrabold">4-beat Space Start</h3>
              </div>
              <span className="rounded-lg bg-violet-500/10 px-2.5 py-1.5 font-mono text-xs font-bold text-violet-400">{config.spaceStartMs > 0 ? formatTime(config.spaceStartMs, 3) : "—"}</span>
            </div>

            <div className={`mt-4 rounded-xl border p-3 ${isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className={`block text-[9px] font-black uppercase tracking-wider ${mutedClass}`}>Selected anchor</span>
                  <strong className="mt-1 block font-mono text-xl">{selectedAnchorMs != null ? formatTime(selectedAnchorMs, 3) : "—"}</strong>
                  <small className={`mt-1 block text-[10px] ${anchorApplied ? "text-emerald-400" : mutedClass}`}>{anchorApplied ? `✓ Applied${config.spaceStartBeat != null ? ` · Beat ${config.spaceStartBeat}` : ""}` : "Not applied yet"}</small>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={buttonClass}
                    disabled={!anchors.length}
                    onClick={() => {
                      const anchor = anchors.find(item => item.ms === selectedAnchorMs) ?? anchors[0];
                      if (anchor) previewAnchor(anchor);
                      else setMessage("Run analysis and select an anchor first.");
                    }}
                    type="button"
                  >
                    {previewingAnchorMs === selectedAnchorMs ? "PREVIEWING…" : "▶ PREVIEW −5s"}
                  </button>
                  <button className={primaryButtonClass} disabled={!anchors.length} onClick={useAnchor} type="button">{anchorApplied ? "✓ APPLIED" : "USE ANCHOR"}</button>
                </div>
              </div>
            </div>

            {anchors.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {anchors.map(anchor => (
                  <button
                    key={`${anchor.beatIndex}-${anchor.ms}`}
                    className={`min-w-[76px] rounded-xl border px-2.5 py-2 text-left transition ${anchor.ms === selectedAnchorMs ? "border-violet-400/70 bg-violet-500/10" : isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`}
                    onClick={() => selectAnchor(anchor)}
                    type="button"
                  >
                    <strong className="block text-[10px]">Beat {anchor.beatIndex}</strong>
                    <small className={`mt-0.5 block font-mono text-[9px] ${mutedClass}`}>{formatTime(anchor.ms, 2)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-4 sm:p-5 lg:col-span-2 ${panelClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Configuration</p>
                <h3 className="mt-1 text-base font-extrabold">Chart details</h3>
              </div>
              {isExistingChart && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">Saved chart</span>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>Title</span><input className={inputClass} value={config.title} onChange={event => patch("title", event.target.value)} /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>Artist</span><input className={inputClass} value={config.artist ?? ""} onChange={event => patch("artist", event.target.value)} /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>Display BPM</span><input className={inputClass} type="number" min={40} max={220} value={config.bpm || ""} onChange={event => patch("bpm", Number(event.target.value) || 0)} /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>BPM exact</span><input className={inputClass} value={typeof exactBpm === "number" ? exactBpm.toFixed(4) : "—"} readOnly /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>Reference / Official BPM</span><input className={inputClass} type="number" min={1} max={400} step="0.0001" value={config.referenceBpm ?? ""} onChange={event => patch("referenceBpm", event.target.value ? Number(event.target.value) : undefined)} placeholder="e.g. 131" /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider"><span className={mutedClass}>Reference source</span><input className={inputClass} value={config.referenceSource ?? ""} onChange={event => patch("referenceSource", event.target.value || undefined)} placeholder="PlayPark / official / manual" /></label>
              <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-wider sm:col-span-2 lg:col-span-3"><span className={mutedClass}>Audio asset</span><input className={inputClass} value={storageFiles.find(asset => asset.url === config.audioUrl)?.name || config.audioUrl || "No audio selected"} readOnly /></label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Reference status", referenceStatus],
                ["Reference end drift", referenceDriftMs == null ? "—" : `${referenceDriftMs >= 0 ? "+" : ""}${referenceDriftMs.toFixed(1)} ms`],
                ["Playback → reference", referencePlaybackRate == null ? "—" : referencePlaybackRate.toFixed(6)],
                ["Reference source", config.referenceSource || "—"],
              ].map(([label, value]) => (
                <div className={`rounded-xl border p-3 ${isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`} key={label}>
                  <small className={`block text-[9px] font-bold uppercase tracking-wider ${mutedClass}`}>{label}</small>
                  <strong className="mt-1 block truncate text-xs">{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div
        ref={audioDockRef}
        className={`fixed inset-x-0 z-[880] border-t backdrop-blur-2xl transition-all ${isDark ? "border-white/10 bg-[#090b12]/95 text-white" : "border-slate-200 bg-white/95 text-slate-900"}`}
        style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className={buttonClass} onClick={() => setDockExpanded(current => !current)} type="button" aria-label={dockExpanded ? "Collapse audio workstation" : "Expand audio workstation"}>
              {dockExpanded ? "−" : "＋"}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className={`block text-[9px] font-black uppercase tracking-[0.16em] ${mutedClass}`}>Audio workstation</span>
                  <strong className="block truncate text-xs">{config.audioUrl ? (config.title || "Untitled track") : "No audio selected"}</strong>
                </div>
                {config.audioUrl && <span className={`shrink-0 font-mono text-[10px] ${mutedClass}`}>{formatTime(currentTimeMs, 3)} / {formatTime(audioDurationMs, 3)}</span>}
              </div>
            </div>
          </div>

          {dockExpanded && (
            <div className="mt-2">
              {config.audioUrl ? (
                <WaveformPlayer
                  ref={waveformRef}
                  url={config.audioUrl}
                  title={config.title}
                  markers={anchors}
                  selectedMarkerMs={selectedAnchorMs}
                  onTimeChange={handleWaveTime}
                  onDurationChange={handleWaveDuration}
                  onPause={() => setPreviewingAnchorMs(null)}
                />
              ) : (
                <button className={`${buttonClass} w-full`} onClick={openAudioLibrary} type="button">Choose an audio file</button>
              )}
            </div>
          )}
        </div>
      </div>

      <footer
        ref={stickyActionsRef}
        className={`fixed inset-x-0 bottom-0 z-[900] border-t backdrop-blur-2xl ${isDark ? "border-white/10 bg-[#080a11]/97" : "border-slate-200 bg-white/97"}`}
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 pt-2 sm:px-6 lg:px-8">
          <div className="hidden min-w-0 flex-1 md:block">
            <strong className="block truncate text-xs">{config.audioUrl ? (config.title || "Untitled track") : "No audio selected"}</strong>
            <span className={`mt-0.5 block truncate text-[10px] ${mutedClass}`}>{message || "Analyze the track, listen for Beat-4, then capture Space Start."}</span>
          </div>
          <button
            className={`${primaryButtonClass} flex-1 sm:flex-none`}
            disabled={!config.audioUrl}
            onClick={() => {
              const liveMs = waveformRef.current?.getCurrentTimeMs() ?? currentTimeMs;
              const rawMs = Math.max(0, Math.min(audioDurationMs, Math.round(liveMs)));
              const nearestAnchor = anchors.length
                ? anchors.reduce((best, anchor) => Math.abs(anchor.ms - rawMs) < Math.abs(best.ms - rawMs) ? anchor : best, anchors[0])
                : undefined;
              const ms = nearestAnchor ? nearestAnchor.ms : rawMs;
              patch("spaceStartMs", ms);
              if (nearestAnchor) patch("spaceStartBeat", nearestAnchor.beatIndex);
              setSelectedAnchorMs(ms);
              setUsedAnchorMs(ms);
              setPreviewingAnchorMs(null);
              if (nearestAnchor) {
                waveformRef.current?.seekTo(ms);
                setCurrentTimeMs(ms);
                const delta = nearestAnchor.ms - rawMs;
                setMessage(`✓ Heard ${formatTime(rawMs, 3)} → snapped ${delta >= 0 ? "+" : ""}${delta}ms to Beat ${nearestAnchor.beatIndex}: ${formatTime(ms, 3)}.`);
              } else {
                setMessage(`✓ Current position applied as Space Start: ${formatTime(ms, 3)}.`);
              }
            }}
            type="button"
          >
            USE CURRENT
          </button>
          <button className={`${buttonClass} flex-1 sm:flex-none`} disabled={saving} onClick={() => { loadConfig(createDraft({ id: makeId() })); setMessage("New chart draft."); }} type="button">RESET</button>
          <button className={`${primaryButtonClass} flex-1 sm:flex-none`} disabled={saving || !config.audioUrl || !config.title.trim() || typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0} onClick={() => void save()} type="button">{saving ? "SAVING…" : "SAVE CHART"}</button>
        </div>
      </footer>

      {addOpen && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddOpen(false); }}>
          <section className={`flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:max-w-3xl sm:rounded-3xl ${isDark ? "border-white/10 bg-[#0d1018] text-white shadow-black/50" : "border-slate-200 bg-white text-slate-900 shadow-slate-900/20"}`} role="dialog" aria-modal="true" aria-labelledby="asset-modal-title">
            <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-5 ${isDark ? "border-white/10 bg-[#0d1018]/95" : "border-slate-200 bg-white/95"}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">Audio Library</p>
                <h2 id="asset-modal-title" className="mt-1 text-xl font-black tracking-tight">Choose audio</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>Checkboxes are for batch analysis. Tap a track row to make it the editor target.</p>
              </div>
              <button className={buttonClass} onClick={() => setAddOpen(false)} type="button" aria-label="Close">✕</button>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <button className={`flex w-full items-center gap-3 rounded-2xl border border-dashed p-3 text-left transition disabled:opacity-40 ${isDark ? "border-violet-400/35 bg-violet-500/5 hover:bg-violet-500/10" : "border-violet-300 bg-violet-50/60 hover:bg-violet-50"}`} disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg font-black text-white shadow-md shadow-violet-600/20">⇧</span>
                <span className="min-w-0">
                  <strong className="block text-sm font-extrabold">{uploading ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…` : "Upload audio files"}</strong>
                  <small className={`mt-0.5 block text-[10px] ${mutedClass}`}>Multi-select · MP3, WAV, M4A, AAC, OGG, FLAC</small>
                </span>
              </button>

              {uploadProgress.total > 1 && (
                <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`}>
                  <span>{uploadProgress.done}/{uploadProgress.total} processed</span>
                  <strong className={uploadProgress.failed ? "text-rose-400" : "text-emerald-400"}>{uploadProgress.failed ? `${uploadProgress.failed} failed` : uploading ? "Sequential upload" : "Done"}</strong>
                </div>
              )}

              <div className="relative">
                <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm ${mutedClass}`}>⌕</span>
                <input className={`${inputClass} pl-9`} value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Search audio files…" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 font-extrabold text-violet-400">{selectedAssetPaths.size} batch selected</span>
                  {editorAsset && <span className={`max-w-[190px] truncate rounded-full px-2.5 py-1 font-semibold ${isDark ? "bg-white/[0.06] text-slate-300" : "bg-slate-100 text-slate-600"}`}>Editor: {editorAsset.name}</span>}
                </div>
                <div className="flex gap-2">
                  <button className={buttonClass} disabled={!filteredAssets.length} onClick={() => {
                    setSelectedAssetPaths(current => new Set([...current, ...filteredAssets.map(asset => asset.path)]));
                    if (!editorAssetPath && filteredAssets[0]) setEditorAssetPath(filteredAssets[0].path);
                  }} type="button">SELECT VISIBLE</button>
                  <button className={buttonClass} disabled={!selectedAssetPaths.size} onClick={() => setSelectedAssetPaths(new Set())} type="button">CLEAR</button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 sm:px-5">
              <div className="space-y-2">
                {filteredAssets.map(asset => {
                  const selected = selectedAssetPaths.has(asset.path);
                  const editorTarget = editorAssetPath === asset.path;
                  const deleting = deletingStoragePath === asset.path;
                  return (
                    <div className={`grid grid-cols-[42px_minmax(0,1fr)_42px] items-stretch overflow-hidden rounded-2xl border transition ${editorTarget ? "border-violet-400/80 ring-2 ring-violet-500/15" : selected ? "border-fuchsia-400/35" : isDark ? "border-white/10" : "border-slate-200"}`} key={asset.path}>
                      <button
                        className={`grid place-items-center border-r transition ${isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50"}`}
                        onClick={() => toggleAsset(asset.path)}
                        type="button"
                        aria-label={`${selected ? "Remove" : "Add"} ${asset.name} ${selected ? "from" : "to"} batch selection`}
                      >
                        <span className={`grid h-6 w-6 place-items-center rounded-lg border text-xs font-black ${selected ? "border-violet-400 bg-violet-500 text-white" : isDark ? "border-white/20 text-transparent" : "border-slate-300 text-transparent"}`}>✓</span>
                      </button>

                      <button
                        className={`flex min-w-0 items-center gap-3 px-3 py-3 text-left transition ${editorTarget ? "bg-violet-500/10" : isDark ? "bg-white/[0.02] hover:bg-white/[0.05]" : "bg-white hover:bg-violet-50/50"}`}
                        onClick={() => setEditorAssetPath(asset.path)}
                        type="button"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-base text-violet-400">♫</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <strong className="block truncate text-xs font-extrabold sm:text-sm">{asset.name}</strong>
                            {editorTarget && <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-violet-400">Editor</span>}
                          </span>
                          <small className={`mt-0.5 block truncate text-[10px] ${mutedClass}`}>{typeof asset.size === "number" ? `${(asset.size / 1024 / 1024).toFixed(2)} MB` : "Supabase Storage"}{asset.updatedAt ? ` · ${new Date(asset.updatedAt).toLocaleDateString()}` : ""}</small>
                        </span>
                        <span className={`shrink-0 text-lg ${editorTarget ? "text-violet-400" : mutedClass}`}>›</span>
                      </button>

                      <button
                        className={`grid place-items-center border-l text-sm transition disabled:opacity-40 ${isDark ? "border-white/10 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15" : "border-slate-200 bg-rose-50/50 text-rose-500 hover:bg-rose-50"}`}
                        disabled={Boolean(deletingStoragePath) || saving}
                        onClick={() => void deleteStorageAsset(asset)}
                        type="button"
                        aria-label={`Delete ${asset.name} from Supabase Storage`}
                        title="Delete audio from Supabase Storage"
                      >
                        {deleting ? "…" : "×"}
                      </button>
                    </div>
                  );
                })}
                {!filteredAssets.length && <div className={`rounded-2xl border border-dashed p-8 text-center text-sm ${isDark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-500"}`}>No audio files found.</div>}
              </div>
            </div>

            <div className={`sticky bottom-0 grid grid-cols-2 gap-2 border-t px-4 py-3 sm:px-5 ${isDark ? "border-white/10 bg-[#0d1018]/98" : "border-slate-200 bg-white/98"}`} style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <button className={buttonClass} disabled={!editorAsset} onClick={() => { if (editorAsset) chooseAsset(editorAsset); }} type="button">
                <span className="hidden sm:inline">USE IN EDITOR</span><span className="sm:hidden">USE EDITOR</span>
              </button>
              <button className={primaryButtonClass} disabled={!selectedAssets.length} onClick={() => queueAssetsForBatch(selectedAssets)} type="button">⚗ ANALYZE {selectedAssets.length || ""} SELECTED</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
