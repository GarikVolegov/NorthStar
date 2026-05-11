"""
Machine Learning API Service for NorthStar
Provides REST endpoints for interacting with ML models
"""

import os
import uuid
import asyncio
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import numpy as np
import joblib

# Import our ML model
from lib.ml.model import SimpleMLModel, generate_sample_data

# Initialize FastAPI app
app = FastAPI(
    title="NorthStar ML API",
    description="API for Machine Learning model operations",
    version="0.1.0"
)

# In-memory storage for models (in production, use a database or model registry)
models: Dict[str, SimpleMLModel] = {}
training_tasks: Dict[str, Dict[str, Any]] = {}

# Pydantic models for request/response validation
class TrainRequest(BaseModel):
    model_id: Optional[str] = None
    n_samples: int = 1000
    n_features: int = 10
    model_type: str = "random_forest"

class TrainResponse(BaseModel):
    task_id: str
    status: str
    message: str

class PredictRequest(BaseModel):
    model_id: str
    features: List[List[float]]

class PredictResponse(BaseModel):
    predictions: List[float]
    probabilities: Optional[List[List[float]]] = None

class ModelInfo(BaseModel):
    model_id: str
    is_trained: bool
    model_path: Optional[str] = None

# Background task for model training
async def train_model_background(task_id: str, model_id: str, n_samples: int, n_features: int):
    """Background task to train a model"""
    try:
        # Update task status
        training_tasks[task_id]["status"] = "processing"
        training_tasks[task_id]["progress"] = 0
        
        # Generate or load data
        X, y = generate_sample_data(n_samples=n_samples, n_features=n_features)
        training_tasks[task_id]["progress"] = 20
        
        # Get or create model
        if model_id not in models:
            model_path = f"models/{model_id}.joblib"
            models[model_id] = SimpleMLModel(model_path=model_path)
        
        model = models[model_id]
        training_tasks[task_id]["progress"] = 40
        
        # Train model
        accuracy = model.train(X, y)
        training_tasks[task_id]["progress"] = 90
        
        # Update task completion
        training_tasks[task_id] = {
            "task_id": task_id,
            "model_id": model_id,
            "status": "completed",
            "progress": 100,
            "accuracy": accuracy,
            "message": f"Model trained successfully with accuracy {accuracy:.4f}"
        }
        
    except Exception as e:
        training_tasks[task_id] = {
            "task_id": task_id,
            "model_id": model_id,
            "status": "failed",
            "progress": 0,
            "error": str(e),
            "message": f"Training failed: {str(e)}"
        }

# API Endpoints
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "NorthStar ML API",
        "version": "0.1.0",
        "status": "running"
    }

@app.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest, background_tasks: BackgroundTasks):
    """
    Start model training in the background
    """
    # Generate model ID if not provided
    model_id = request.model_id or str(uuid.uuid4())
    task_id = str(uuid.uuid4())
    
    # Initialize task
    training_tasks[task_id] = {
        "task_id": task_id,
        "model_id": model_id,
        "status": "queued",
        "progress": 0,
        "message": "Training task queued"
    }
    
    # Start background task
    background_tasks.add_task(
        train_model_background,
        task_id=task_id,
        model_id=model_id,
        n_samples=request.n_samples,
        n_features=request.n_features
    )
    
    return TrainResponse(
        task_id=task_id,
        status="queued",
        message=f"Training started for model {model_id}"
    )

@app.get("/train/{task_id}")
async def get_training_status(task_id: str):
    """
    Get the status of a training task
    """
    if task_id not in training_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return training_tasks[task_id]

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Make predictions using a trained model
    """
    if request.model_id not in models:
        raise HTTPException(status_code=404, detail=f"Model {request.model_id} not found")
    
    model = models[request.model_id]
    
    if not model.is_trained:
        raise HTTPException(status_code=400, detail=f"Model {request.model_id} is not trained")
    
    try:
        # Convert features to numpy array
        features = np.array(request.features)
        
        # Make predictions
        predictions = model.predict(features).tolist()
        probabilities = model.predict_proba(features).tolist()
        
        return PredictResponse(
            predictions=predictions,
            probabilities=probabilities
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.get("/models/{model_id}", response_model=ModelInfo)
async def get_model_info(model_id: str):
    """
    Get information about a specific model
    """
    if model_id not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    
    model = models[model_id]
    return ModelInfo(
        model_id=model_id,
        is_trained=model.is_trained,
        model_path=model.model_path
    )

@app.get("/models")
async def list_models():
    """
    List all available models
    """
    return {
        "models": [
            {
                "model_id": model_id,
                "is_trained": model.is_trained,
                "model_path": model.model_path
            }
            for model_id, model in models.items()
        ]
    }

@app.post("/models/{model_id}/load")
async def load_model(model_id: str, model_path: Optional[str] = None):
    """
    Load a pre-trained model from disk
    """
    if model_id in models:
        model = models[model_id]
    else:
        if model_path is None:
            model_path = f"models/{model_id}.joblib"
        model = SimpleMLModel(model_path=model_path)
        models[model_id] = model
    
    success = model.load()
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to load model from {model_path}")
    
    return {"message": f"Model {model_id} loaded successfully"}

@app.post("/models/{model_id}/save")
async def save_model(model_id: str):
    """
    Save a model to disk
    """
    if model_id not in models:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    
    model = models[model_id]
    if not model.is_trained:
        raise HTTPException(status_code=400, detail=f"Model {model_id} is not trained")
    
    model.save()
    return {"message": f"Model {model_id} saved successfully"}

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "models_loaded": len(models),
        "active_tasks": len([t for t in training_tasks.values() if t["status"] == "processing"])
    }

if __name__ == "__main__":
    # For direct execution (development)
    import uvicorn
    # Create models directory if it doesn't exist
    os.makedirs("models", exist_ok=True)
    uvicorn.run(app, host="0.0.0.0", port=8000)