import re
import nltk
from nltk.corpus import wordnet
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

# Download NLTK resources saat startup
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('punkt')
    nltk.download('punkt_tab') 
    nltk.download('wordnet')
    nltk.download('averaged_perceptron_tagger')

lemmatizer = WordNetLemmatizer()
print(f"NLTK version: {nltk.__version__}")
print(f"Available data: {nltk.data.path}")

# Map POS tag to first character lemmatize() accepts
def get_wordnet_pos(word):
    tag = nltk.pos_tag([word])[0][1][0].upper()
    tag_dict = {"J": wordnet.ADJ,
                "N": wordnet.NOUN,
                "V": wordnet.VERB,
                "R": wordnet.ADV}
    return tag_dict.get(tag, wordnet.NOUN)

# Bersihkan dan normalisasi teks
def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'[^\w\s]', '', text)
    return text

# Preprocessing teks dengan lemmatization dan normalisasi
def preprocess_text(text: str) -> str:
    text = clean_text(text)
    tokens = word_tokenize(text)
    
    # Lemmatize each word with proper POS tag
    lemmatized_tokens = [lemmatizer.lemmatize(word, get_wordnet_pos(word)) for word in tokens]
    return ' '.join(lemmatized_tokens)

# Tambahkan sinonim untuk kata-kata penting dalam teks
def expand_with_synonyms(text: str, max_synonyms=2) -> str:
    text = clean_text(text)
    tokens = word_tokenize(text)
    expanded_tokens = tokens.copy()
    
    # Tambahkan sinonim untuk kata-kata penting (nouns, verbs)
    for word in tokens:
        # Skip kata pendek (biasanya kurang penting)
        if len(word) <= 3:
            continue
            
        # Cari sinonim
        synonyms = set()
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonym = lemma.name().replace('_', ' ')
                # Hindari kata yang sama atau sudah ada
                if synonym != word and synonym not in tokens:
                    synonyms.add(synonym)
                    if len(synonyms) >= max_synonyms:
                        break
            if len(synonyms) >= max_synonyms:
                break
        
        # Tambahkan sinonim ke teks
        expanded_tokens.extend(list(synonyms))
    
    return ' '.join(expanded_tokens)

# Gabungkan nama dan deskripsi item dengan penanganan konteks yang lebih baik
def combine_item_text(item_name: str, description: str, with_synonyms=True) -> str:
    # Bersihkan teks
    item_name = clean_text(item_name) if item_name else ""
    description = clean_text(description) if description else ""
    
    # Batasi panjang
    max_desc_len = 200
    if len(description) > max_desc_len:
        description = description[:max_desc_len]
    
    # Gabungkan dengan bobot pada nama item
    combined_text = f"{item_name} {item_name} {description}"
    
    if with_synonyms and len(combined_text) < 150:  # Hanya tambahkan sinonim jika teksnya tidak terlalu panjang
        # Tambahkan sinonim untuk memperluas konteks
        expanded_text = expand_with_synonyms(combined_text, max_synonyms=1)  # Kurangi jumlah sinonim
        return expanded_text
    
    return combined_text