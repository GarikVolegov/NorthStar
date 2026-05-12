import { z } from "zod";

/**
 * Types for ML API Requests and Responses
 */
export const TrainRequestSchema = z.object({
  model_id: z.string().optional(),
  n_samples: z.number().default(1000),
  n_features: z.number().default(10),
  model_type: z.string().default("random_forest"),
});

export const TrainResponseSchema = z.object({
  task_id: z.string(),
  status: z.string(),
  message: z.string(),
});

export const PredictRequestSchema = z.object({
  model_id: z.string(),
  features: z.array(z.array(z.number())),
});

export const PredictResponseSchema = z.object({
  predictions: z.array(z.number()),
  probabilities: z.array(z.array(z.number())).optional(),
});

export const ModelInfoSchema = z.object({
  model_id: z.string(),
  is_trained: z.boolean(),
  model_path: z.string().optional(),
});

export type TrainRequest = z.infer<typeof TrainRequestSchema>;
export type TrainResponse = z.infer<typeof TrainResponseSchema>;
export type PredictRequest = z.infer<typeof PredictRequestSchema>;
export type PredictResponse = z.infer<typeof PredictResponseSchema>;
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export interface MLClientOptions {
  baseUrl?: string;
  timeout?: number;
}

/**
 * NorthStar ML API Client
 */
export class MLClient {
  private baseUrl: string;
  private timeout: number;

  constructor(options: MLClientOptions = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:8000";
    this.timeout = options.timeout || 30000;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`ML API Error (${response.status}): ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Starts training a model in the background.
   */
  async trainModel(request: TrainRequest): Promise<TrainResponse> {
    const response = await this.request<TrainResponse>("/train", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return TrainResponseSchema.parse(response);
  }

  /**
   * Checks the status of a background training task.
   */
  async getTrainingStatus(taskId: string): Promise<any> {
    return await this.request<any>(`/train/${taskId}`);
  }

  /**
   * Makes predictions using a trained model.
   */
  async predict(request: PredictRequest): Promise<PredictResponse> {
    const response = await this.request<PredictResponse>("/predict", {
      method: "POST",
      body: JSON.stringify(request),
    });
    return PredictResponseSchema.parse(response);
  }

  /**
   * Gets information about a specific model.
   */
  async getModelInfo(modelId: string): Promise<ModelInfo> {
    const response = await this.request<ModelInfo>(`/models/${modelId}`);
    return ModelInfoSchema.parse(response);
  }

  /**
   * Lists all available models.
   */
  async listModels(): Promise<{ models: ModelInfo[] }> {
    const response = await this.request<{ models: ModelInfo[] }>("/models");
    return response;
  }

  /**
   * Loads a pre-trained model from disk.
   */
  async loadModel(modelId: string, modelPath?: string): Promise<{ message: string }> {
    const path = modelPath ? `/models/${modelId}/load?model_path=${encodeURIComponent(modelPath)}` : `/models/${modelId}/load`;
    return await this.request<{ message: string }>(path, {
      method: "POST",
    });
  }

  /**
   * Saves a model to disk.
   */
  async saveModel(modelId: string): Promise<{ message: string }> {
    return await this.request<{ message: string }>(`/models/${modelId}/save`, {
      method: "POST",
    });
  }

  /**
   * Checks if the ML service is healthy.
   */
  async healthCheck(): Promise<{ status: string; models_loaded: number; active_tasks: number }> {
    return await this.request<{ status: string; models_loaded: number; active_tasks: number }>("/health");
  }
}
