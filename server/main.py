import os
from typing import List, Dict
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PyPDF2 import PdfReader
from openai import AzureOpenAI
import tiktoken
import uuid
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from pydantic import BaseModel
import time

load_dotenv()

class Config:
    def __init__(self):
        self.AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
        self.AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
        self.validate_credentials()
        
        self.AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")
        self.AZURE_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT", "text-embedding-3-small")
        self.AZURE_CHAT_DEPLOYMENT = os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-35-turbo")
        self.PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "rag-index")
        self.PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1")

    def validate_credentials(self):
        if not self.AZURE_OPENAI_API_KEY:
            raise ValueError("AZURE_OPENAI_API_KEY is not set in environment variables")
        if not self.AZURE_OPENAI_ENDPOINT:
            raise ValueError("AZURE_OPENAI_ENDPOINT is not set in environment variables")
        if not self.PINECONE_API_KEY:
            raise ValueError("PINECONE_API_KEY is not set in environment variables")

try:
    config = Config()
    azure_client = AzureOpenAI(
        api_key=config.AZURE_OPENAI_API_KEY,
        api_version=config.AZURE_OPENAI_API_VERSION,
        azure_endpoint=config.AZURE_OPENAI_ENDPOINT
    )
    pc = Pinecone(api_key=config.PINECONE_API_KEY)
    if config.PINECONE_INDEX_NAME not in pc.list_indexes().names():
        pc.create_index(
            name=config.PINECONE_INDEX_NAME,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region=config.PINECONE_REGION
            )
        )
    pinecone_index = pc.Index(config.PINECONE_INDEX_NAME)
except Exception as e:
    print(f"Initialization error: {str(e)}")
    exit(1)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://fullstack-dinesh.github.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    question: str
    session_id: str = None

class UploadResponse(BaseModel):
    message: str
    session_id: str

class QueryResponse(BaseModel):
    answer: str  

def extract_text_from_pdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    return " ".join([page.extract_text() for page in reader.pages])

def chunk_text(text: str, chunk_size: int = 512) -> List[str]:
    tokenizer = tiktoken.get_encoding("cl100k_base")
    tokens = tokenizer.encode(text)
    return [tokenizer.decode(tokens[i:i + chunk_size]) for i in range(0, len(tokens), chunk_size)]

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    response = azure_client.embeddings.create(
        input=texts,
        model=config.AZURE_EMBEDDING_DEPLOYMENT
    )
    return [np.array(embedding.embedding).tolist() for embedding in response.data]

def upsert_documents(documents: List[Dict], namespace: str):
    pinecone_index.upsert(vectors=documents, namespace=namespace)

def query_vector_store(vector: List[float], namespace: str = None, top_k: int = 3):
    params = {"vector": vector, "top_k": top_k, "include_metadata": True}
    if namespace:
        params["namespace"] = namespace
    return pinecone_index.query(**params)

RAG_PROMPT_TEMPLATE = """
Answer the question based only on the following context:
{context}

Question: {question}
"""

def generate_response(question: str, context: List[str]) -> str:
    formatted_context = "\n".join([f"- {c}" for c in context])
    response = azure_client.chat.completions.create(
        model=config.AZURE_CHAT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": RAG_PROMPT_TEMPLATE.format(
                question=question,
                context=formatted_context
            )}
        ],
        temperature=0.3
    )
    return response.choices[0].message.content

@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files supported")
    
    session_id = str(uuid.uuid4())
    temp_path = f"temp_{session_id}.pdf"
    
    try:
        with open(temp_path, "wb") as f:
            f.write(await file.read())
        
        text = extract_text_from_pdf(temp_path)
        chunks = chunk_text(text)
        embeddings = generate_embeddings(chunks)
        
        documents = [{
            "id": str(uuid.uuid4()),
            "values": embedding,
            "metadata": {"text": chunk, "filename": file.filename}
        } for chunk, embedding in zip(chunks, embeddings)]
        
        upsert_documents(documents, session_id)
        return UploadResponse(
            message=f"Processed {len(chunks)} chunks",
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/query", response_model=QueryResponse)
async def process_query(request: QueryRequest):
    try:
        embedding = generate_embeddings([request.question])[0]
        results = query_vector_store(embedding, request.session_id)
        context = [match.metadata["text"] for match in results.matches]
        answer = generate_response(request.question, context)
        return QueryResponse(answer=answer)
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
