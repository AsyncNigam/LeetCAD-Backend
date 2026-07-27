export enum SubmissionStatus {
  PENDING = "PENDING",
  UPLOADED = "UPLOADED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface OutboxEvent<T = unknown> {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: T;
  createdAt: Date;
}

export interface SubmissionCreatedPayload {
  submissionId: string;
  userId: string;
  fileKey: string;
  bucketName: string;
}

export interface AssessmentMetrics {
  volume: number;
  surfaceArea: number;
  centerOfMass: [number, number, number];
}

export interface AssessmentCompletedPayload {
  submissionId: string;
  userId: string;
  status: SubmissionStatus;
  score: number;
  aiReportId: string;
  metrics: AssessmentMetrics;
  renderUrls: string[];
}
