# Supabase-First Persistence & Real-Time Auto-Sync Architecture

This plan establishes robust Supabase-first persistence and auto-refresh mechanisms so that records created, advanced through phases, or modified do not reset when restarting or switching between environments (such as AI Studio preview and Render), and UI data updates in real-time.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Confirmed Persistence Strategy**: Force full initial load and bidirectional synchronization directly from Supabase on server startup and client navigation/actions.
> - **Confirmed UI Update Frequency**: Automatic synchronization and state refresh on tab changes, data mutations, and user actions.

---

## 1. Overview & Core Concept

- **What It Does**: Ensures all expedientes, interesados, and document cases loaded in Supabase remain synchronized and persistent, eliminating stale memory caches or reset states on server restart/Render deployment.
- **Key Value**: Guarantees 100% data integrity and live state updates across all dashboard views without data loss or rollback.

---

## 2. User Experience & Visual Design

- **Live Synchronization Indicators**: Subtle status notifications when syncing with Supabase in the background.
- **Seamless State Persistence**: Expedientes created or advanced remain active in their current phase across page reloads and Render deployments.

---

## 3. Key Product Decisions & Trade-Offs

- **Supabase as Source of Truth**: Chosen over local in-memory mock storage for all persistent records to prevent resets during deployments.
- **Auto-Polling & Event Triggering**: Ensures the preview and production apps automatically re-fetch state upon tab switches or modal actions.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────┐          ┌─────────────────────────┐
│     React Frontend      │          │     Express Backend     │
│   (src/App.tsx / UI)    │◄────────►│       (server.ts)       │
└─────────────────────────┘          └────────────┬────────────┘
                                                  │
                                                  ▼
                                     ┌─────────────────────────┐
│    Supabase PostgreSQL    │
│  (Persisted DB in Cloud)  │
└─────────────────────────┘
```

- **Data Flow**: Frontend triggers actions -> Backend processes and persists directly to Supabase (`supabaseAdmin`) -> Immediate client state refresh via `recargarDatosSistema()`.
