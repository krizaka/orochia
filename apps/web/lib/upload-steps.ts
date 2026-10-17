/** Where an upload stands, as the three steps of its journey (the kit's Stepper draws them). Pure. */
export type UploadStatus = "queued" | "uploading" | "paused" | "completed" | "error";
export type UploadStepStatus = "done" | "current" | "upcoming" | "error";
export interface UploadStep {
  id: "send" | "encode" | "live";
  status: UploadStepStatus;
  /** 0 to 1, only for the step whose progress we really know (the bytes sent). */
  value?: number;
}

export function uploadSteps(status: UploadStatus | undefined, progressPercent: number): UploadStep[] {
  const value = Math.min(Math.max(progressPercent / 100, 0), 1);
  if (status === "completed")
    return [
      { id: "send", status: "done" },
      { id: "encode", status: "current" },
      { id: "live", status: "upcoming" },
    ];
  if (status === "error")
    return [
      { id: "send", status: "error" },
      { id: "encode", status: "upcoming" },
      { id: "live", status: "upcoming" },
    ];
  return [
    { id: "send", status: "current", value },
    { id: "encode", status: "upcoming" },
    { id: "live", status: "upcoming" },
  ];
}
