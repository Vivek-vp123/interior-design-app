import os
import uuid
import torch
import logging
import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from torchvision import transforms
from torchvision.models.segmentation import (
    deeplabv3_resnet50,
    lraspp_mobilenet_v3_large,
    DeepLabV3_ResNet50_Weights,
    LRASPP_MobileNet_V3_Large_Weights,
)
from typing import Dict, List, Tuple, Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
import traceback
from datetime import datetime
import json
import openai  # If using OpenAI
from typing import List, Dict
import random
import httpx
from dotenv import load_dotenv


# -----------------------------
# Logging Configuration
# -----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("segmentation_service.log", encoding="utf-8")
    ]
)
logger = logging.getLogger(__name__)

# -----------------------------
# App Configuration
# -----------------------------
app = FastAPI(
    title="Interior Design AI - Segmentation Service",
    description="DeepLabV3-based image segmentation for interior design analysis",
    version="1.0.0"
)

# Directories
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
CACHE_DIR = "cache"

for dir_path in [UPLOAD_DIR, OUTPUT_DIR, CACHE_DIR]:
    os.makedirs(dir_path, exist_ok=True)

# Static file serving
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Configuration & Constants
# -----------------------------
# Keep defaults conservative for 512MB free-tier environments.
MAX_IMAGE_SIZE = int(os.getenv("MAX_IMAGE_SIZE", "768"))
SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MODEL_VARIANT = os.getenv("SEGMENTATION_MODEL", "lraspp").strip().lower()
PRELOAD_MODEL = os.getenv("PRELOAD_MODEL", "false").strip().lower() == "true"

# Thread pool for CPU-intensive tasks
executor = ThreadPoolExecutor(max_workers=1)

# -----------------------------
# Device Configuration
# -----------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f" Using device: {device}")

# Keep CPU thread count small to reduce memory pressure on free instances.
torch.set_num_threads(int(os.getenv("TORCH_NUM_THREADS", "1")))

if torch.cuda.is_available():
    logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    logger.info(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")

# -----------------------------
# Model Management
# -----------------------------
model = None
preprocess = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

# DeepLabV3 class labels
DEEPLABV3_CLASSES = [
    'background', 'aeroplane', 'bicycle', 'bird', 'boat', 'bottle', 'bus',
    'car', 'cat', 'chair', 'cow', 'dining table', 'dog', 'horse', 'motorbike',
    'person', 'potted plant', 'sheep', 'sofa', 'train', 'tv/monitor'
]

# Interior-relevant classes
INTERIOR_CLASSES = {
    'chair': 9,
    'dining table': 11,
    'potted plant': 16,
    'sofa': 18,
    'tv/monitor': 20
}

# Enhanced color palette
PALETTE = np.array([
    [0, 0, 0],        # background - black
    [128, 0, 0],      # aeroplane - maroon
    [0, 128, 0],      # bicycle - green
    [128, 128, 0],    # bird - olive
    [0, 0, 128],      # boat - navy
    [128, 0, 128],    # bottle - purple
    [0, 128, 128],    # bus - teal
    [128, 128, 128],  # car - gray
    [64, 0, 0],       # cat - dark red
    [192, 0, 0],      # chair - red
    [64, 128, 0],     # cow - yellow green
    [192, 128, 0],    # dining table - orange
    [64, 0, 128],     # dog - dark purple
    [192, 0, 128],    # horse - pink
    [64, 128, 128],   # motorbike - dark cyan
    [192, 128, 128],  # person - light pink
    [0, 64, 0],       # potted plant - dark green
    [128, 64, 0],     # sheep - brown
    [0, 192, 0],      # sofa - light green
    [128, 192, 0],    # train - yellow
    [0, 64, 128],     # tv/monitor - dark blue
], dtype=np.uint8)

def load_model():
    """Load and cache the segmentation model"""
    global model
    if model is None:
        logger.info(f"Loading segmentation model variant: {MODEL_VARIANT}")
        try:
            if MODEL_VARIANT in {"deeplab", "deeplabv3", "resnet50"}:
                model = deeplabv3_resnet50(
                    weights=DeepLabV3_ResNet50_Weights.COCO_WITH_VOC_LABELS_V1
                )
            else:
                # Default to a lighter model for free-tier memory constraints.
                model = lraspp_mobilenet_v3_large(
                    weights=LRASPP_MobileNet_V3_Large_Weights.COCO_WITH_VOC_LABELS_V1
                )

            model = model.to(device)
            model.eval()
            logger.info("[OK] Model loaded")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    return model

# -----------------------------
# Image Processing Functions
# -----------------------------
def validate_image(data: bytes, filename: str) -> None:
    """Validate image data and format"""
    if len(data) > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size is {MAX_FILE_SIZE/1e6:.1f}MB")
    
    ext = os.path.splitext(filename.lower())[1]
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format. Supported: {', '.join(SUPPORTED_FORMATS)}")

def read_image(data: bytes) -> np.ndarray:
    """Read image from bytes"""
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return img

def resize_image(img: np.ndarray, max_size: int = MAX_IMAGE_SIZE) -> Tuple[np.ndarray, float]:
    """Resize image maintaining aspect ratio"""
    h, w = img.shape[:2]
    scale = 1.0
    
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    return img, scale

def extract_dominant_colors(img: np.ndarray, k: int = 5) -> List[Dict[str, any]]:
    """Extract dominant colors with percentages"""
    # Resize for faster processing
    small_img = cv2.resize(img, (150, 150))
    data = small_img.reshape((-1, 3)).astype(np.float32)
    
    # K-means clustering
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.2)
    _, labels, centers = cv2.kmeans(data, k, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    
    # Calculate percentages
    unique, counts = np.unique(labels, return_counts=True)
    percentages = counts / len(labels) * 100
    
    # Sort by percentage
    sorted_idx = np.argsort(percentages)[::-1]
    
    colors = []
    for idx in sorted_idx:
        center = centers[idx].astype(int)
        colors.append({
            "hex": f"#{center[2]:02x}{center[1]:02x}{center[0]:02x}",
            "rgb": [int(center[2]), int(center[1]), int(center[0])],
            "percentage": float(percentages[idx])
        })
    
    return colors

def colorize_mask(predictions: np.ndarray) -> np.ndarray:
    """Apply color palette to predictions"""
    h, w = predictions.shape
    colored = np.zeros((h, w, 3), dtype=np.uint8)
    
    for class_id in range(len(PALETTE)):
        mask = predictions == class_id
        colored[mask] = PALETTE[class_id]
    
    return colored

def analyze_segmentation(predictions: np.ndarray) -> Dict[str, any]:
    """Analyze segmentation results for interior-relevant objects"""
    h, w = predictions.shape
    total_pixels = h * w
    
    # Count pixels per class
    unique, counts = np.unique(predictions, return_counts=True)
    class_stats = {}
    
    for class_id, count in zip(unique, counts):
        if class_id < len(DEEPLABV3_CLASSES):
            class_name = DEEPLABV3_CLASSES[class_id]
            percentage = (count / total_pixels) * 100
            
            if percentage > 0.1:  # Only include if >0.1% of image
                class_stats[class_name] = {
                    "pixels": int(count),
                    "percentage": round(percentage, 2),
                    "color": PALETTE[class_id].tolist()
                }
    
    # Extract interior-specific insights
    interior_objects = []
    for name, class_id in INTERIOR_CLASSES.items():
        if name in class_stats:
            interior_objects.append({
                "type": name,
                "coverage": class_stats[name]["percentage"]
            })
    
    return {
        "classes": class_stats,
        "interior_objects": interior_objects,
        "num_objects": len([c for c in class_stats if c != 'background'])
    }

# -----------------------------
# Background Tasks
# -----------------------------
async def cleanup_old_files():
    """Clean up old files periodically"""
    try:
        current_time = datetime.now().timestamp()
        for directory in [UPLOAD_DIR, OUTPUT_DIR]:
            for filename in os.listdir(directory):
                filepath = os.path.join(directory, filename)
                file_age = current_time - os.path.getmtime(filepath)
                if file_age > 3600:  # 1 hour
                    os.remove(filepath)
                    logger.info(f"Cleaned up old file: {filename}")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")

# -----------------------------
# API Endpoints
# -----------------------------
@app.post("/segment")
async def segment_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Segment an uploaded image using DeepLabV3
    
    Returns:
    - Segmentation mask URL
    - Dominant colors
    - Object analysis
    - Processing metadata
    """
    global device, model  # Declare at the beginning
    
    start_time = datetime.now()
    
    try:
        # Read and validate file
        data = await file.read()
        validate_image(data, file.filename)
        
        # Read image data
        img_bgr = read_image(data)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Image reading error: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file")
    
    # Generate unique ID
    uid = uuid.uuid4().hex
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # File paths
    img_path = os.path.join(UPLOAD_DIR, f"{uid}_{timestamp}.jpg")
    mask_path = os.path.join(OUTPUT_DIR, f"{uid}_{timestamp}_mask.png")
    
    # Save original image
    with open(img_path, "wb") as f:
        f.write(data)
    
    try:
        # Prepare image for model
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        img_resized, scale = resize_image(img_rgb)
        pil_img = Image.fromarray(img_resized)
        
        # Load model
        model = load_model()
        
        # Prepare input tensor
        input_tensor = preprocess(pil_img).unsqueeze(0).to(device)
        
        # Run inference
        with torch.no_grad():
            output = model(input_tensor)["out"][0]
        
        # Process predictions
        predictions = output.argmax(0).byte().cpu().numpy()
        
        # Resize predictions back to original size if needed
        if scale != 1.0:
            orig_h, orig_w = img_bgr.shape[:2]
            predictions = cv2.resize(
                predictions, 
                (orig_w, orig_h), 
                interpolation=cv2.INTER_NEAREST
            )
        
        # Generate colored mask
        mask_colored = colorize_mask(predictions)
        
        # Save colored mask
        Image.fromarray(mask_colored).save(mask_path)
        
        # Extract insights
        dominant_colors = extract_dominant_colors(img_bgr)
        segmentation_analysis = analyze_segmentation(predictions)
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Schedule cleanup
        background_tasks.add_task(cleanup_old_files)
        
        # Prepare response - matching the original format
        response = {
            "mask_url": f"/outputs/{os.path.basename(mask_path)}",
            "dominant_colors": [color["hex"] for color in dominant_colors[:3]],  # Top 3 colors
            "width": img_bgr.shape[1],
            "height": img_bgr.shape[0],
            "device": str(device),
            "analysis": segmentation_analysis,
            "processing_time": processing_time * 1000,  # Convert to ms
            "detected_objects": segmentation_analysis.get("interior_objects", []) 
        }
        
        return JSONResponse(content=response)
        
    except torch.cuda.OutOfMemoryError:
        logger.error("[WARN] GPU out of memory, attempting CPU fallback...")
        torch.cuda.empty_cache()
        
        # Switch to CPU
        device = torch.device("cpu")
        model = None  # Force reload on CPU
        
        # Retry on CPU
        return await segment_image(background_tasks, file)
        
    except Exception as e:
        logger.error(f"Segmentation error: {traceback.format_exc()}")
        
        # Clean up files on error
        for path in [img_path, mask_path]:
            if os.path.exists(path):
                os.remove(path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Segmentation failed: {str(e)}"
        )
    
# Add this new endpoint for AI suggestions
load_dotenv() 
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
@app.post("/generate-suggestions")
async def generate_suggestions(request: dict):
    """
    Generate AI-powered furniture and decor suggestions using OpenRouter
    """
    try:
        room_context = {
            "room_id": request.get("room_id"),
            "dominant_colors": request.get("dominant_colors", []),
            "detected_objects": request.get("detected_objects", []),
            "room_type": request.get("room_type", "Unknown"),
            "color_scheme": request.get("color_scheme", "Neutral"),
        }

        # --- Call OpenRouter ---
        try:
            async with httpx.AsyncClient(base_url="https://openrouter.ai/api/v1", timeout=60.0) as client:
                response = await client.post(
                    "/chat/completions",
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-mini",  # you can change model
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "You are an AI interior design assistant. "
                                    "Generate 6-10 personalized furniture and decor suggestions "
                                    "based on the room context. "
                                    "Return ONLY JSON in the format: "
                                    "{'suggestions':[{'name':str,'category':str,'description':str,"
                                    "'reason':str,'confidence':int,'price':str}]}"
                                )
                            },
                            {"role": "user", "content": f"Room context: {room_context}"}
                        ],
                        "response_format": {"type": "json_object"}
                    }
                )

                data = response.json()
                ai_text = data["choices"][0]["message"]["content"]

                # Parse JSON safely
                suggestions = json.loads(ai_text).get("suggestions", [])
        except Exception as e:
            logger.error(f"OpenRouter error: {e}")
            suggestions = []

        # --- If AI failed, fallback to static ---
        if not suggestions:
            logger.warning("[WARN] Falling back to static catalog")
            suggestions = [
                {
                    "name": "Indoor Plant Set",
                    "category": "Decor",
                    "description": "Low-maintenance plants to freshen up your space",
                    "reason": "Complements neutral tones",
                    "confidence": 85,
                    "price": "$65"
                },
                {
                    "name": "Abstract Canvas Art",
                    "category": "Decor",
                    "description": "Modern wall art to enhance your room",
                    "reason": "Adds color balance",
                    "confidence": 80,
                    "price": "$120"
                }
            ]

        return {
            "success": True,
            "suggestions": suggestions,
            "analysis_summary": {
                "room_type": room_context["room_type"],
                "color_scheme": room_context["color_scheme"],
                "object_count": len(room_context["detected_objects"]),
                "primary_color": room_context["dominant_colors"][0] if room_context["dominant_colors"] else None
            }
        }

    except Exception as e:
        logger.error(f"Suggestion generation error: {traceback.format_exc()}")
        return {"success": False, "error": str(e), "suggestions": []}


def complementary_color(hex_color):
    """Generate complementary color for a given hex color"""
    # Simple complementary color calculation
    if not hex_color or not hex_color.startswith("#"):
        return "#808080"
    
    try:
        # Convert hex to RGB
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
        
        # Calculate complementary
        comp_r = 255 - r
        comp_g = 255 - g
        comp_b = 255 - b
        
        return f"#{comp_r:02x}{comp_g:02x}{comp_b:02x}"
    except:
        return "#808080"

def analogous_color(hex_color):
    """Generate analogous color for a given hex color"""
    if not hex_color or not hex_color.startswith("#"):
        return "#808080"
    
    try:
        # Simple shift in hue for analogous color
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
        
        # Shift hue slightly
        new_r = min(255, r + 30)
        new_g = min(255, g + 20)
        new_b = min(255, b + 10)
        
        return f"#{new_r:02x}{new_g:02x}{new_b:02x}"
    except:
        return "#808080"

@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "status": "DeepLab segmentation service running",
        "device": str(device)
    }
@app.get("/analyze/{room_id}")
async def analyze_room(room_id: str):
    """
    Re-analyze a previously processed room image by ID.
    This simulates "real-time" suggestions using stored outputs.
    """
    try:
        # Look for existing mask/output
        matching_mask = None
        for f in os.listdir(OUTPUT_DIR):
            if room_id in f and f.endswith("_mask.png"):
                matching_mask = os.path.join(OUTPUT_DIR, f)
                break

        if not matching_mask:
            raise HTTPException(status_code=404, detail="Mask not found for this room")

        # Load mask back as numpy
        mask_img = cv2.imread(matching_mask, cv2.IMREAD_COLOR)
        gray_mask = cv2.cvtColor(mask_img, cv2.COLOR_BGR2GRAY)

        # Run segmentation analysis again
        segmentation_analysis = analyze_segmentation(gray_mask)

        # For simplicity, we extract colors again from uploads
        matching_upload = None
        for f in os.listdir(UPLOAD_DIR):
            if room_id in f:
                matching_upload = os.path.join(UPLOAD_DIR, f)
                break

        dominant_colors = []
        if matching_upload:
            img_bgr = cv2.imread(matching_upload)
            if img_bgr is not None:
                dominant_colors = extract_dominant_colors(img_bgr)

        return {
            "room_id": room_id,
            "mask_url": f"/outputs/{os.path.basename(matching_mask)}",
            "dominant_colors": [c["hex"] for c in dominant_colors[:3]],
            "analysis": segmentation_analysis,
            "detected_objects": segmentation_analysis.get("interior_objects", []),
            "color_scheme": "Bright" if segmentation_analysis.get("num_objects", 0) > 2 else "Neutral",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Realtime analysis error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Realtime analysis failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model": "loaded" if model is not None else "lazy-not-loaded",
        "model_variant": MODEL_VARIANT,
        "device": str(device),
        "timestamp": datetime.now().isoformat(),
    }

# -----------------------------
# Startup Events
# -----------------------------
@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("[START] Starting Interior Design AI Segmentation Service...")
    
    if PRELOAD_MODEL:
        try:
            load_model()
            logger.info("[OK] Model preloaded")
        except Exception as e:
            logger.error(f"Model preload failed: {e}")

    logger.info("[OK] Service ready!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("[STOP] Shutting down service...")
    
    # Clear GPU cache if using CUDA
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    logger.info("[OK] Service stopped")

# -----------------------------
# Run the service
# -----------------------------
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
    