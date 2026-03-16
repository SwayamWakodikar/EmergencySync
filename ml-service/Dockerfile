# ─── Stage 1: Base image ───────────────────────────────
# Use a slim Python image to keep the final container small
FROM python:3.11-slim

# Set working directory inside container
WORKDIR /app

# ─── Stage 2: Install dependencies ─────────────────────
# Copy requirements first (Docker caches this layer — speeds up rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Stage 3: Copy project files ───────────────────────
COPY . .

# ─── Stage 4: Train the model at build time ────────────
# This runs train.py to generate model/severity_model/ inside the container.
# On subsequent deploys, if the dataset hasn't changed, this is cached by Docker.
RUN python train.py

# ─── Stage 5: Expose port and start API ────────────────
EXPOSE 8000

# Start the FastAPI server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
