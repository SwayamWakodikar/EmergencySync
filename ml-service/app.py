from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification
import uvicorn

# 1. Initialize FastAPI app
app = FastAPI(title="EmergencySync ML Service")

# 2. Load model and tokenizer from the trained directory
MODEL_DIR = "model/severity_model"
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

try:
    print(f"Loading model from disk onto {device}...")
    tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_DIR)
    model = DistilBertForSequenceClassification.from_pretrained(MODEL_DIR)
    # Move model to GPU
    model.to(device)
    # Put model in evaluation mode
    model.eval()
    print("Model loaded successfully!")
except Exception as e:
    print(f"Error loading model: {e}")
    # Fallback to random if model fails to load (optional, but good for stability)

# 3. Define the input data schema
class EmergencyRequest(BaseModel):
    description: str

# 4. Define the API endpoint
@app.post("/predict-severity")
def predict_severity(req: EmergencyRequest):
    if not req.description or len(req.description.strip()) == 0:
        raise HTTPException(status_code=400, detail="Description is required")
        
    # Tokenize the input text and move it to the GPU
    inputs = tokenizer(
        req.description, 
        return_tensors="pt", 
        truncation=True, 
        padding=True, 
        max_length=128
    ).to(device)
    
    # Run prediction (no gradients needed)
    with torch.no_grad():
        outputs = model(**inputs)
        
    # Get the predicted class (0 to 4)
    logits = outputs.logits
    predicted_class = torch.argmax(logits, dim=-1).item()
    
    # Map back to severity (1 to 5)
    severity = predicted_class + 1
    
    return {
        "description": req.description,
        "predicted_severity": severity
    }

# 5. Health check endpoint for Render/deployment
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "EmergencySync ML"}

if __name__ == "__main__":
    # Run the server on port 8000
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
