import sys
import json
import os
import re

# Try importing whisper, if fails, print error clearly
try:
    import whisper
except ImportError:
    print(json.dumps({"error": "openai-whisper module not found. Please install it: pip install openai-whisper"}))
    sys.exit(1)

def analyze_sentiment(text):
    """
    Simple keyword-based emotion detection for 'Director Mode'.
    Since we don't have true audio emotion analysis, we infer it from text content.
    """
    text_lower = text.lower()
    
    emotions = []
    
    # Excited / Wow
    if re.search(r'\b(wow|gila|keren|mantap|anjir|anjay|buset|waduh|wah)\b', text_lower):
        emotions.append({"atSec": 0.0, "emotion": "excited"})
    
    # Confused / Questioning
    elif re.search(r'\b(kok|kenapa|gimana|masa|hah|bingung)\b', text_lower):
        emotions.append({"atSec": 0.0, "emotion": "confused"})
        
    # Negative / Problem
    elif re.search(r'\b(rusak|jelek|parah|mahal|susah|ribet|hancur)\b', text_lower):
        emotions.append({"atSec": 0.0, "emotion": "frustrated"})
        
    # Default
    if not emotions:
        emotions.append({"atSec": 0.0, "emotion": "neutral"})
        
    return emotions

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio file provided"}))
        sys.exit(1)

    audio_path = sys.argv[1]

    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        # Load Model (Base is a good balance of speed/accuracy for CPU)
        model = whisper.load_model("base")
        
        # Transcribe
        result = model.transcribe(audio_path)
        text = result["text"].strip()
        
        # Analyze
        emotions = analyze_sentiment(text)
        
        # Construct JSON Output matching Gemini's schema
        output = {
            "script_text": text,
            "duration_sec": 0, # Whisper doesn't give total duration easily in result dict, we can assume frontend sent it or calc it
            "emotion_timeline": emotions,
            "cue_words": [] # Whisper has segments/timestamps, we could map them but for now keep simple
        }
        
        # Add basic segments as cue words if needed
        # (Whisper segments have {start, end, text})
        if "segments" in result:
            cues = []
            for seg in result["segments"]:
                cues.append({
                    "atSec": seg["start"],
                    "word": seg["text"].strip()
                })
            output["cue_words"] = cues[:10] # Limit to first 10 to avoid bloating JSON
            
            # Update duration from last segment
            if result["segments"]:
                output["duration_sec"] = result["segments"][-1]["end"]

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
