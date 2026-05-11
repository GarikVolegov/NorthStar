"""
Test script for NorthStar ML API
Demonstrates how to use the ML API endpoints
"""

import requests
import json
import time
import numpy as np

# API base URL
BASE_URL = "http://localhost:8000"

def test_root_endpoint():
    """Test the root endpoint"""
    print("Testing root endpoint...")
    response = requests.get(f"{BASE_URL}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_train_model():
    """Test model training"""
    print("Testing model training...")
    
    # Request training
    train_data = {
        "n_samples": 100,
        "n_features": 5
    }
    
    response = requests.post(f"{BASE_URL}/train", json=train_data)
    print(f"Train request status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        task_id = result["task_id"]
        print(f"Training started with task ID: {task_id}")
        
        # Poll for completion
        print("Waiting for training to complete...")
        for i in range(10):  # Try for 10 seconds
            time.sleep(1)
            status_response = requests.get(f"{BASE_URL}/train/{task_id}")
            if status_response.status_code == 200:
                status_result = status_response.json()
                print(f"Task status: {status_result['status']} (progress: {status_result['progress']}%)")
                
                if status_result["status"] == "completed":
                    print(f"Training completed! Accuracy: {status_result.get('accuracy', 'N/A')}")
                    break
                elif status_result["status"] == "failed":
                    print(f"Training failed: {status_result.get('error', 'Unknown error')}")
                    break
            else:
                print(f"Error checking status: {status_response.status_code}")
                break
        else:
            print("Timeout waiting for training to complete")
    else:
        print(f"Error: {response.text}")
    print()

def test_predict():
    """Test making predictions"""
    print("Testing predictions...")
    
    # First, we need a trained model. Let's check if we have any models.
    response = requests.get(f"{BASE_URL}/models")
    if response.status_code == 200:
        models_data = response.json()
        print(f"Available models: {len(models_data['models'])}")
        
        if len(models_data['models']) > 0:
            # Use the first available model
            model_id = models_data['models'][0]['model_id']
            print(f"Using model: {model_id}")
            
            # Make a prediction
            predict_data = {
                "model_id": model_id,
                "features": [
                    [0.1, 0.2, 0.3, 0.4, 0.5],
                    [-0.1, -0.2, -0.3, -0.4, -0.5],
                    [0.5, 0.4, 0.3, 0.2, 0.1]
                ]
            }
            
            response = requests.post(f"{BASE_URL}/predict", json=predict_data)
            print(f"Predict request status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"Predictions: {result['predictions']}")
                print(f"Probabilities shape: {len(result['probabilities'])} x {len(result['probabilities'][0]) if result['probabilities'] else 0}")
            else:
                print(f"Error: {response.text}")
        else:
            print("No trained models available. Please train a model first.")
    else:
        print(f"Error getting models: {response.text}")
    print()

def main():
    """Run all tests"""
    print("Starting NorthStar ML API tests...\n")
    
    try:
        test_root_endpoint()
        test_health_endpoint()
        test_train_model()
        test_predict()
        print("Tests completed!")
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to the API. Make sure the server is running on localhost:8000")
        print("You can start it with: python main.py")
    except Exception as e:
        print(f"Unexpected error: {e}")

if __name__ == "__main__":
    main()