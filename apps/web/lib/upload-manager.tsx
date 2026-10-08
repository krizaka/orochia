"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import * as tus from "tus-js-client";

export interface TusSessionConfig {
  tusEndpoint: string;
  videoGuid: string;
  headers: {
    AuthorizationSignature: string;
    AuthorizationExpire: number;
    VideoId: string;
    LibraryId: number;
  };
}

export interface UploadItem {
  id: string;
  title: string;
  type: "video" | "story";
  fileName: string;
  fileSize: number;
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  speedBytesPerSec: number;
  timeRemainingSec: number | null;
  status: "queued" | "uploading" | "paused" | "completed" | "error";
  errorMessage: string | null;
  videoId?: string;
}

interface StartUploadParams {
  id: string;
  title: string;
  file: File;
  session: TusSessionConfig;
  type?: "video" | "story";
  videoId?: string;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}

interface UploadManagerContextType {
  uploads: UploadItem[];
  hasActiveUploads: boolean;
  isDockMinimized: boolean;
  setIsDockMinimized: (minimized: boolean) => void;
  startUpload: (params: StartUploadParams) => void;
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  dismissUpload: (id: string) => void;
}

const UploadManagerContext = createContext<UploadManagerContextType | null>(null);

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDockMinimized, setIsDockMinimized] = useState(false);

  // Keep references to active Tus uploads and tracking stats outside render cycle
  const tusInstancesRef = useRef<Map<string, tus.Upload>>(new Map());
  const statsTrackerRef = useRef<
    Map<
      string,
      {
        lastBytes: number;
        lastTimestamp: number;
        smoothedSpeed: number;
      }
    >
  >(new Map());

  const startUpload = useCallback(
    ({
      id,
      title,
      file,
      session,
      type = "video",
      videoId,
      onSuccess,
      onError,
    }: StartUploadParams) => {
      // Initialize state for this item
      const newItem: UploadItem = {
        id,
        title,
        type,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        bytesUploaded: 0,
        bytesTotal: file.size,
        speedBytesPerSec: 0,
        timeRemainingSec: null,
        status: "uploading",
        errorMessage: null,
        videoId,
      };

      setUploads((prev) => {
        const filtered = prev.filter((item) => item.id !== id);
        return [newItem, ...filtered];
      });

      statsTrackerRef.current.set(id, {
        lastBytes: 0,
        lastTimestamp: Date.now(),
        smoothedSpeed: 0,
      });

      const upload = new tus.Upload(file, {
        endpoint: session.tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: session.headers.AuthorizationSignature,
          AuthorizationExpire: String(session.headers.AuthorizationExpire),
          VideoId: session.headers.VideoId,
          LibraryId: String(session.headers.LibraryId),
        },
        metadata: {
          filetype: file.type,
          title,
        },
        onError: (err) => {
          console.error(`[UploadManager] Upload failed for ${id}:`, err);
          setUploads((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: "error",
                    errorMessage: err.message || "Upload encountered an error",
                    speedBytesPerSec: 0,
                    timeRemainingSec: null,
                  }
                : item
            )
          );
          onError?.(err);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const tracker = statsTrackerRef.current.get(id);

          let currentSpeed = 0;
          let remainingSec: number | null = null;

          if (tracker) {
            const timeDiff = (now - tracker.lastTimestamp) / 1000;
            if (timeDiff >= 0.5) {
              const bytesDiff = bytesUploaded - tracker.lastBytes;
              const rawSpeed = bytesDiff / timeDiff;
              // Exponential moving average for smooth display
              const smoothed =
                tracker.smoothedSpeed === 0 ? rawSpeed : tracker.smoothedSpeed * 0.7 + rawSpeed * 0.3;
              tracker.smoothedSpeed = smoothed;
              tracker.lastBytes = bytesUploaded;
              tracker.lastTimestamp = now;
              currentSpeed = smoothed;
            } else {
              currentSpeed = tracker.smoothedSpeed;
            }

            if (currentSpeed > 0) {
              const remainingBytes = bytesTotal - bytesUploaded;
              remainingSec = Math.max(1, Math.round(remainingBytes / currentSpeed));
            }
          }

          const percentage = Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));

          setUploads((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    bytesUploaded,
                    bytesTotal,
                    progress: percentage,
                    speedBytesPerSec: currentSpeed,
                    timeRemainingSec: remainingSec,
                    status: "uploading",
                  }
                : item
            )
          );
        },
        onSuccess: () => {
          setUploads((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    progress: 100,
                    bytesUploaded: item.bytesTotal,
                    speedBytesPerSec: 0,
                    timeRemainingSec: 0,
                    status: "completed",
                  }
                : item
            )
          );
          statsTrackerRef.current.delete(id);
          tusInstancesRef.current.delete(id);
          onSuccess?.();
        },
      });

      tusInstancesRef.current.set(id, upload);
      upload.start();
    },
    []
  );

  const pauseUpload = useCallback((id: string) => {
    const upload = tusInstancesRef.current.get(id);
    if (upload) {
      upload.abort();
    }
    setUploads((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "paused",
              speedBytesPerSec: 0,
              timeRemainingSec: null,
            }
          : item
      )
    );
  }, []);

  const resumeUpload = useCallback((id: string) => {
    const upload = tusInstancesRef.current.get(id);
    if (upload) {
      setUploads((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "uploading",
              }
            : item
        )
      );
      const tracker = statsTrackerRef.current.get(id);
      if (tracker) {
        tracker.lastTimestamp = Date.now();
      }
      upload.start();
    }
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const upload = tusInstancesRef.current.get(id);
    if (upload) {
      upload.abort(true);
      tusInstancesRef.current.delete(id);
    }
    statsTrackerRef.current.delete(id);
    setUploads((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const dismissUpload = useCallback((id: string) => {
    setUploads((prev) => prev.filter((item) => item.id !== id));
    statsTrackerRef.current.delete(id);
    tusInstancesRef.current.delete(id);
  }, []);

  const hasActiveUploads = uploads.some(
    (u) => u.status === "uploading" || u.status === "queued" || u.status === "paused"
  );

  return (
    <UploadManagerContext.Provider
      value={{
        uploads,
        hasActiveUploads,
        isDockMinimized,
        setIsDockMinimized,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        dismissUpload,
      }}
    >
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error("useUploadManager must be used within an UploadManagerProvider");
  }
  return ctx;
}
