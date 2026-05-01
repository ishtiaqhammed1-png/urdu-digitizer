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

// ✅ API key from Vercel environment variable (VITE_ prefix required)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL   = "gemini-2.5-flash-preview-05-20"; // latest stable flash

const App = () => {
  const [files, setFiles]           = useState([]);
  const [base64Files, setBase64Files] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [resultHtml, setResultHtml] = useState("");
  const [status, setStatus]         = useState("");
  const [error, setError]           = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = "UrduDigitizer | AI-Powered Urdu OCR";
  }, []);

  // ── File selection ──────────────────────────────────────────────
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

  // ── Drag & drop support ─────────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (dt.files.length) {
      const fakeEvent = { target: { files: dt.files } };
      handleFileChange(fakeEvent);
    }
  };

  // ── Reset workspace ─────────────────────────────────────────────
  const resetWorkspace = () => {
    setFiles([]);
    setBase64Files([]);
    setResultHtml("");
    setStatus("");
    setError("");
    const inp = document.getElementById('file-upload-input');
    if (inp) inp.value = '';
  };

  // ── Clean AI HTML response ──────────────────────────────────────
  const cleanAiResponse = (text) => {
    let cleaned = text.replace(/```html|```/gi, '').trim();
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    return cleaned;
  };

  // ── Main processing ─────────────────────────────────────────────
  const processFile = async () => {
    if (!base64Files.length) {
      setError("Please select at least one file to continue.");
      return;
    }
    if (!API_KEY) {
      setError("API key not configured. Please contact the site admin.");
      return;
    }

    setLoading(true);
    setError("");
    setStatus(`Processing ${base64Files.length} document${base64Files.length > 1 ? 's' : ''}…`);

    const systemPrompt = `
You are an elite, zero-tolerance OCR engine for Urdu documents.
FORBIDDEN: NEVER use <ul>, <li>, or <ol> tags. Use only <p> tags for each line.
STRICT STRUCTURAL RULES:
1. ABSOLUTE FIDELITY: Transcribe EVERY word.
2. MASHQ HEADINGS: Use <h2> for chapter titles. MUST be center-aligned.
3. TOPIC HEADINGS: Use <h3> for internal headings. Wrap <h3> and its paragraph in ONE <div class="keep-together">.
4. BOLDING: Wrap ALL Questions, Instructions, and Statements in <strong> tags.
5. UNDERLINING: ALL handwritten blanks in <u> tags.
6. MCQ HANDLING: Transcribe ALL options. Correct answer as "جواب: (x)" on a new line.
7. TRUE/FALSE: Output ONLY the result in parentheses, e.g. "(درست)".
8. ENGLISH WORDS: Wrap in <span class="english-word">...</span>.
9. GROUPING: Wrap related items in ONE single <div class="keep-together">.
10. OUTPUT: Raw HTML body content only. No markdown, no code fences.
    `.trim();

    const parts = [
      { text: "Digitize fully. Group instructions with related items. Deterministic output." },
      ...base64Files.map((f) => ({ inlineData: { mimeType: f.mimeType, data: f.data } })),
    ];

    const payload = {
      contents: [{ parts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.0, topP: 0.1, topK: 1 },
    };

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 95000);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data    = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (content) {
        setResultHtml(cleanAiResponse(content));
        setStatus("Processing complete. Your document is ready.");
      } else {
        throw new Error("The AI returned an empty response. Please try again.");
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError("Request timed out after 95 seconds. Please try a smaller file.");
      } else {
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Word download ───────────────────────────────────────────────
  const downloadWord = () => {
    const styles = `
      <style>
        @font-face { font-family: 'Jameel Noori Nastaleeq'; src: local('Jameel Noori Nastaleeq'); }
        body { font-family: 'Jameel Noori Nastaleeq', serif; direction: rtl; text-align: right; font-size: 16pt; line-height: 1.8; }
        h2  { text-align: center; color: #000; font-weight: bold; margin-bottom: 20pt; }
        h3  { text-align: right;  color: #000; font-weight: bold; font-size: 18pt; margin-bottom: 10pt; }
        .keep-together { page-break-inside: avoid !important; display: block; margin-bottom: 15pt; mso-pagination: widow-orphan lines-together; }
        .english-word  { font-family: Arial; direction: ltr; unicode-bidi: embed; font-size: 14pt; color: #2563eb; }
        u      { font-weight: bold; text-underline-offset: 4px; }
        strong { color: #000; }
        p      { margin: 6pt 0; }
      </style>
    `;
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8">${styles}</head>
      <body>${resultHtml}</body>
      </html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href  = URL.createObjectURL(blob);
    link.download = `UrduDigitizer_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openMail = (e) => {
    e.preventDefault();
    window.location.assign("mailto:mrahtisham1122@gmail.com");
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans text-gray-900 flex flex-col" dir="ltr">

      {/* ── HEADER ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold" style={{ fontFamily: 'serif' }}>ا</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              Urdu<span className="font-light text-gray-400">Digitizer</span>
            </h1>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
            <span className="text-gray-900 border-b-2 border-gray-900 pb-0.5 cursor-default">Workspace</span>
            <a href="https://ai.google.dev/gemini-api" target="_blank" rel="noreferrer"
               className="hover:text-gray-900 transition-colors">About API</a>
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-md border border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-gray-500">System Online</span>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-gray-500 hover:text-gray-900"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 flex flex-col gap-3 text-sm font-medium text-gray-600">
            <span className="text-gray-900 font-semibold">Workspace</span>
            <a href="https://ai.google.dev/gemini-api" target="_blank" rel="noreferrer"
               className="hover:text-gray-900">About API</a>
          </div>
        )}
      </header>

      {/* ── MAIN ── */}
      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-12 md:py-16">

        {/* Hero text */}
        <div className="text-center mb-12">
          <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Powered by Gemini AI
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
            Digitize Urdu Documents
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Upload your Urdu PDFs or images. Our AI OCR engine will transcribe and format them into a clean Microsoft Word document.
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-10">
          <div className="p-8 md:p-10">

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer
                ${files.length > 0
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'}`}
            >
              <input
                id="file-upload-input"
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              {files.length > 0 ? (
                <>
                  <div className="w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                    <CheckCircle2 size={26} strokeWidth={1.5} />
                  </div>
                  <p className="text-gray-900 font-semibold text-lg">
                    {files.length} File{files.length > 1 ? 's' : ''} Ready
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3 max-w-sm">
                    {files.slice(0, 4).map((f, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium truncate max-w-[130px]">
                        {f.name}
                      </span>
                    ))}
                    {files.length > 4 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-semibold">
                        +{files.length - 4} more
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-4">Click to change files</p>
                </>
              ) : (
                <>
                  <UploadCloud size={48} className="text-gray-300 mb-4" strokeWidth={1} />
                  <p className="text-gray-900 font-semibold text-lg">Click or drag files here</p>
                  <p className="text-gray-400 text-sm mt-1.5">PDF, JPG, PNG supported · Multiple files allowed</p>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {!resultHtml ? (
                <button
                  onClick={processFile}
                  disabled={loading || files.length === 0}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2
                    ${loading || files.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 hover:bg-black text-white shadow-md active:scale-[0.98]'}`}
                >
                  {loading
                    ? <><Loader2 className="animate-spin w-5 h-5" /> Processing…</>
                    : <><ArrowRight size={20} /> Start Digitization</>}
                </button>
              ) : (
                <button
                  onClick={resetWorkspace}
                  className="flex-1 py-4 px-6 rounded-xl font-semibold text-base bg-gray-900 hover:bg-black text-white shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={20} /> Process New Documents
                </button>
              )}

              {resultHtml && (
                <button
                  onClick={downloadWord}
                  className="flex-1 py-4 px-6 rounded-xl font-semibold text-base border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Download size={20} className="text-gray-500" /> Download .doc
                </button>
              )}
            </div>

            {/* Status / error */}
            {(status || error) && (
              <div className="mt-5">
                {status && !error && (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 text-sm font-medium">
                    <CheckCircle2 size={16} /> {status}
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-100 text-sm font-medium">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* How it works — only shown when idle */}
        {!resultHtml && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { step: '01', title: 'Upload', desc: 'Select one or more Urdu document images or PDFs from your device.' },
              { step: '02', title: 'AI Processing', desc: 'Gemini AI reads every word with zero-tolerance fidelity.' },
              { step: '03', title: 'Download', desc: 'Get a perfectly formatted RTL Word document ready to use.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="text-xs font-black text-gray-300 mb-2 tracking-widest">{step}</div>
                <div className="font-bold text-gray-900 mb-1">{title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Preview */}
        {resultHtml && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Monitor size={18} className="text-gray-400" /> Document Preview
              </h3>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Read Only</span>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="w-full max-w-[210mm] mx-auto min-h-[297mm] p-8 sm:p-14 md:p-20">
                <style>{`
                  .neve-render h2  { text-align:center; font-weight:bold; font-size:1.8rem; margin:30px 0; color:#111827; }
                  .neve-render h3  { text-align:right;  font-weight:bold; font-size:1.4rem; margin:20px 0 10px; color:#111827; }
                  .neve-render .keep-together { margin-bottom:25px; }
                  .neve-render .english-word  { font-family:'Inter',Arial,sans-serif; direction:ltr; unicode-bidi:embed; display:inline-block; font-size:1.1rem; color:#4b5563; font-weight:500; }
                  .neve-render u      { font-weight:bold; text-decoration:underline; text-underline-offset:4px; }
                  .neve-render strong { color:#111827; font-weight:bold; }
                  .neve-render p      { margin:10px 0; color:#374151; }
                `}</style>
                <div
                  className="neve-render"
                  style={{ direction:'rtl', textAlign:'right', fontFamily:"'Noto Nastaliq Urdu', serif", lineHeight:'2.5' }}
                  dangerouslySetInnerHTML={{ __html: resultHtml }}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} UrduDigitizer · Powered by Gemini AI
          </p>
          <button onClick={openMail}
                  className="group flex items-center gap-2 px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors">
            <span className="text-gray-400 text-sm">Developed by</span>
            <span className="text-gray-900 font-semibold text-sm group-hover:text-blue-600 transition-colors">Ahtisham</span>
            <Mail size={15} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
          </button>
        </div>
      </footer>

    </div>
  );
};

export default App;
