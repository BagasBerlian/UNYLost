import re

# Clean and normalize text for embedding generation
def clean_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'[^\w\s]', '', text)
    return text

# Combine item name and description for better embedding
def combine_item_text(item_name: str, description: str) -> str:
    item_name = clean_text(item_name)
    description = clean_text(description)
    return f"{item_name} {item_name} {description}"