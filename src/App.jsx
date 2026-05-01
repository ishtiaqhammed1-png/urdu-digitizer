```jsx
import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Mail,
  Menu,
  Globe,
  Monitor,
  RefreshCw,
  X
} from 'lucide-react';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const App = () => {
  const [files, setFiles] = useState([]);
  const [base64Files, setBase64Files] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "UrduDigitizer | AI-Powered Urdu OCR";
  }, []);

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    setFiles(selectedFiles);
    setResultHtml("");
    setError("");
    setStatus("");

    const readAsBase64 = (file) =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve({ mimeType: file.type, data: reader.result.split(',')[1] });
        reader.readAsDataURL(file);
      });

    const results = await Promise.all(selectedFiles.map(readAsBase64));
    setBase64Files(results);
  };

  const processFile = async () => {
    if (!base64Files.length) {
      setError("Please select at least one file.");
      return;
    }
    if (!API_KEY) {
      setError("API key not configured.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus(`Processing ${base64Files.length} document...`);

    const systemPrompt = "You are an elite OCR engine for Urdu. Output clean HTML only.";

    const payload = {
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            ...base64Files.map(f => ({
              type: "image_url",
              image_url: { url: `data:${f.mimeType};base64,${f.data}` }
            }))
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.0
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 95000);

    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;

      if (content) {
        setResultHtml(content);
        setStatus("Done!");
      } else {
        throw new Error("Empty response");
      }

    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadWord = () => {
    const html = `<html><body>${resultHtml}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `UrduDigitizer.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>Urdu OCR</h2>

      <input type="file" multiple onChange={handleFileChange} />

      <br /><br />

      <button onClick={processFile} disabled={loading}>
        {loading ? "Processing..." : "Start"}
      </button>

      <br /><br />

      {error && <p style={{ color: "red" }}>{error}</p>}
      {status && <p>{status}</p>}

      {resultHtml && (
        <>
          <button onClick={downloadWord}>Download</button>
          <div dangerouslySetInnerHTML={{ __html: resultHtml }} />
        </>
      )}
    </div>
  );
};

export default App;
```
