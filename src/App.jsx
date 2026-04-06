import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

/**
 * Dream Canvas AI - Persistent Sidebar Experience
 */

function App() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load history from Supabase on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
  };

  const handleMouseMove = (e) => {
    const card = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - card.left) / card.width) * 100;
    const y = ((e.clientY - card.top) / card.height) * 100;
    setMousePos({ x, y });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const query = async (data) => {
    const response = await fetch(
      "https://router.huggingface.co/nscale/v1/images/generations",
      {
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  };

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setImage(null);

    try {
      const result = await query({
        response_format: "b64_json",
        prompt: prompt,
        model: "stabilityai/stable-diffusion-xl-base-1.0",
      });

      let imageData = null;
      if (result.data && result.data[0] && result.data[0].b64_json) {
        imageData = `data:image/png;base64,${result.data[0].b64_json}`;
      } else if (result.b64_json) {
        imageData = `data:image/png;base64,${result.b64_json}`;
      }

      if (imageData) {
        setImage(imageData);
        const { error: insertError } = await supabase
          .from('history')
          .insert([{ prompt, image: imageData }]);

        if (insertError) {
          console.error("Error saving to history:", insertError);
        } else {
          fetchHistory();
        }
      } else {
        throw new Error("No image data received from API.");
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError(err.message || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item) => {
    setPrompt(item.prompt);
    setImage(item.image);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const clearHistory = async () => {
    if (window.confirm("Clear all cloud history?")) {
      const { error } = await supabase.from('history').delete().neq('id', 0);
      if (error) console.error("Error clearing history:", error);
      else setHistory([]);
    }
  };

  return (
    <div className="app-layout" data-theme={theme}>
      {/* Sidebar Section */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-group">
            <h3>Cloud History</h3>
            <div className="sidebar-badge">Beta</div>
          </div>
          <button className="clear-history-btn" onClick={clearHistory} title="Clear all history">
            Clear
          </button>
        </div>

        <div className="history-search-dummy">
          <span className="search-icon">🔍</span>
          <span>Search history...</span>
        </div>

        <div className="history-scroll-area">
          {history.length > 0 ? (
            history.map((item) => (
              <div 
                key={item.id} 
                className="history-item-card"
                onClick={() => loadFromHistory(item)}
              >
                <div className="history-item-thumb">
                  <img src={item.image} alt="History thumbnail" />
                </div>
                <div className="history-item-info">
                  <p className="history-item-prompt">{item.prompt}</p>
                  <span className="history-item-date">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="history-empty-state">
              <div className="empty-icon">📂</div>
              <p>Your creative journey begins here.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Component */}
      <main className="main-wrapper">
        <nav className="top-navbar">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? '✕' : '☰'}
          </button>
          
          <div className="nav-logo">Dream Canvas</div>

          <div className="nav-actions">
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="user-avatar-dummy">JD</div>
          </div>
        </nav>

        <section className="generator-container">
          <div className="content-box">
             <div
              className="card"
              onMouseMove={handleMouseMove}
              style={{
                '--mouse-x': `${mousePos.x}%`,
                '--mouse-y': `${mousePos.y}%`
              }}
            >
              <div className="card-header">
                <h2>Generate Vision</h2>
                <div className="engine-badge">SDXL Turbo</div>
              </div>

              <div className="creator-section">
                <div className="textarea-glow-wrapper">
                  <textarea
                    placeholder="Describe what you want to see..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="preset-container">
                  <span onClick={() => setPrompt('Futuristic cyberpunk landscape, neon architecture, foggy atmosphere, 8k')}>#CyberCity</span>
                  <span onClick={() => setPrompt('Ancient mythical temple, jungle overgrown, golden hour light, cinematic')}>#Relics</span>
                  <span onClick={() => setPrompt('Cute baby dragon sitting on a volcano, pixar style, 3d render')}>#Mythical</span>
                </div>

                <button
                  className="dream-button"
                  onClick={generateImage}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? (
                    <div className="btn-loading">
                      <div className="loader-dot"></div>
                      Dreaming...
                    </div>
                  ) : (
                    <>Generate <span>✦</span></>
                  )}
                </button>
              </div>

              {error && <div className="error-banner">{error}</div>}

              <div className="visualization-area">
                {loading ? (
                  <div className="manifesting-state">
                    <div className="pulse-loader"></div>
                    <p>Manifesting your imagination...</p>
                  </div>
                ) : image ? (
                  <div className="image-frame">
                    <img src={image} alt={prompt} />
                  </div>
                ) : (
                  <div className="initial-state">
                    <div className="sparkle-icon">✨</div>
                    <p>Enter a prompt and click generate to create something unique.</p>
                  </div>
                )}
              </div>

              <footer className="card-footer">
                <div className="connection-status">
                  <span className="dot online"></span>
                  Cloud Synced
                </div>
                <div className="footer-links">
                  <span>Usage Guide</span>
                  <span>Credits: Unlimited</span>
                </div>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
