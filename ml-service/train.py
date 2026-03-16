import pandas as pd
import numpy as np
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments,
)
from torch.utils.data import Dataset
import os

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
DATA_PATH  = "data/dataset.csv"
MODEL_NAME = "model/distilbert-base-uncased"   # local downloaded model
SAVE_PATH  = "model/severity_model"      # where the trained model gets saved
NUM_LABELS = 5                           # severity 1–5
EPOCHS     = 5
BATCH_SIZE = 8

# ─────────────────────────────────────────────
# DETECT GPU
# ─────────────────────────────────────────────
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"\n✅ Using device: {device.upper()}")
if device == "cuda":
    print(f"   GPU: {torch.cuda.get_device_name(0)}\n")

# ─────────────────────────────────────────────
# LOAD DATASET
# ─────────────────────────────────────────────
print("📂 Loading dataset...")
df = pd.read_csv(DATA_PATH)
df.columns = df.columns.str.strip()
df["description"] = df["description"].str.strip()

# Convert severity 1–5 → label index 0–4
df["label"] = df["severity"].astype(int) - 1

print(f"   Total samples: {len(df)}")
print(f"   Severity distribution:\n{df['severity'].value_counts().sort_index()}\n")

# ─────────────────────────────────────────────
# TRAIN / TEST SPLIT
# ─────────────────────────────────────────────
train_texts, val_texts, train_labels, val_labels = train_test_split(
    df["description"].tolist(),
    df["label"].tolist(),
    test_size=0.2,
    random_state=42,
    stratify=df["label"],
)

print(f"   Training samples : {len(train_texts)}")
print(f"   Validation samples: {len(val_texts)}\n")

# ─────────────────────────────────────────────
# TOKENIZER
# ─────────────────────────────────────────────
print(f"📥 Loading tokenizer: {MODEL_NAME}  (downloads on first run)...")
tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_NAME)

train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=128)
val_encodings   = tokenizer(val_texts,   truncation=True, padding=True, max_length=128)

# ─────────────────────────────────────────────
# PYTORCH DATASET
# ─────────────────────────────────────────────
class EmergencyDataset(Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels    = labels

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[idx])
        return item

train_dataset = EmergencyDataset(train_encodings, train_labels)
val_dataset   = EmergencyDataset(val_encodings,   val_labels)

# ─────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────
print(f"\n📥 Loading model: {MODEL_NAME}  (downloads on first run)...")
model = DistilBertForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=NUM_LABELS,
)
model.to(device)

# ─────────────────────────────────────────────
# TRAINING ARGUMENTS
# ─────────────────────────────────────────────
os.makedirs(SAVE_PATH, exist_ok=True)
os.makedirs("model/checkpoints", exist_ok=True)

training_args = TrainingArguments(
    output_dir                  = "model/checkpoints",
    num_train_epochs            = EPOCHS,
    per_device_train_batch_size = BATCH_SIZE,
    per_device_eval_batch_size  = BATCH_SIZE,
    eval_strategy               = "epoch",
    save_strategy               = "epoch",
    load_best_model_at_end      = True,
    metric_for_best_model       = "eval_loss",
    logging_dir                 = "model/logs",
    logging_steps               = 10,
    warmup_steps                = 10,
    weight_decay                = 0.01,
    use_cpu                     = (device == "cpu"),
    report_to                   = "none",   # disable wandb
)

# ─────────────────────────────────────────────
# TRAINER
# ─────────────────────────────────────────────
trainer = Trainer(
    model           = model,
    args            = training_args,
    train_dataset   = train_dataset,
    eval_dataset    = val_dataset,
)

# ─────────────────────────────────────────────
# TRAIN
# ─────────────────────────────────────────────
print("\n🚀 Starting training...\n")
trainer.train()

# ─────────────────────────────────────────────
# SAVE MODEL + TOKENIZER
# ─────────────────────────────────────────────
print(f"\n💾 Saving model to: {SAVE_PATH}")
trainer.save_model(SAVE_PATH)
tokenizer.save_pretrained(SAVE_PATH)
print("✅ Model saved!\n")

# ─────────────────────────────────────────────
# EVALUATE
# ─────────────────────────────────────────────
print("📊 Evaluation on validation set:\n")
predictions  = trainer.predict(val_dataset)
pred_labels  = np.argmax(predictions.predictions, axis=1)
true_labels  = val_labels

report = classification_report(
    true_labels,
    pred_labels,
    target_names=["Severity 1", "Severity 2", "Severity 3", "Severity 4", "Severity 5"],
)
print(report)
print("✅ Training complete! Model is ready to use.\n")
