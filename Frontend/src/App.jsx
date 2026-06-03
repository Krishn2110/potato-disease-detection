import { useMemo, useState } from 'react'
import heroImg from './assets/hero.png'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/predict'

const CLASS_NAMES = ['Early Blight', 'Late Blight', 'Healthy']

const diseaseDetails = {
  'Early Blight': {
    tone: 'warning',
    label: 'Fungal leaf spot risk',
    summary:
      'Early blight is often linked with older leaf lesions and can spread when foliage stays damp.',
    symptoms: 'Brown target-like spots, yellowing around lesions, and damage that usually begins on older leaves.',
    treatment:
      'Remove infected leaves, improve spacing for airflow, and use an appropriate fungicide if infection spreads.',
    guidance: ['Remove infected leaves', 'Improve airflow', 'Avoid overhead watering'],
  },
  'Late Blight': {
    tone: 'danger',
    label: 'High spread risk',
    summary:
      'Late blight can move quickly in cool, humid conditions and needs fast field action.',
    symptoms: 'Dark water-soaked patches, pale edges, rapid leaf collapse, and possible white growth in humid weather.',
    treatment:
      'Separate affected plants, destroy badly infected foliage, and get local agricultural guidance quickly.',
    guidance: ['Isolate affected plants', 'Destroy heavily infected foliage', 'Consult local crop support'],
  },
  Healthy: {
    tone: 'success',
    label: 'No disease detected',
    summary:
      'The leaf looks healthy based on the model prediction. Keep monitoring for new spots or wilting.',
    symptoms: 'Even green leaf color with no spreading dark lesions, target spots, or water-soaked patches.',
    treatment:
      'Keep the plant under regular observation and continue good watering, spacing, and crop rotation practices.',
    guidance: ['Keep leaves dry', 'Rotate crops', 'Inspect plants weekly'],
  },
}

function normalizeClassName(value) {
  if (!value) return ''

  const cleanedValue = String(value)
    .replace('Potato___', '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()

  if (cleanedValue.includes('early')) return 'Early Blight'
  if (cleanedValue.includes('late')) return 'Late Blight'
  if (cleanedValue.includes('healthy')) return 'Healthy'

  return String(value).trim()
}

function normalizePredictionResponse(data) {
  const rawClass =
    data?.predicted_class ??
    data?.predictedClass ??
    data?.class ??
    data?.class_name ??
    data?.label ??
    data?.disease

  let predictedClass = normalizeClassName(rawClass)
  let confidence = data?.confidence ?? data?.score ?? data?.probability

  const predictionScores = data?.predictions?.[0] ?? data?.prediction ?? data?.scores

  if (!predictedClass && Array.isArray(predictionScores)) {
    const bestIndex = predictionScores.indexOf(Math.max(...predictionScores))
    predictedClass = CLASS_NAMES[bestIndex] ?? ''
    confidence = predictionScores[bestIndex]
  }

  return {
    predictedClass,
    confidence: Number(confidence ?? 0),
    details: diseaseDetails[predictedClass],
    raw: data,
  }
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [prediction, setPrediction] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const predictedClass = prediction?.predictedClass ?? ''

  const confidence = useMemo(() => {
    if (prediction?.confidence === undefined || prediction?.confidence === null) return 0

    const score = Number(prediction.confidence)
    const normalizedScore = score > 1 ? score : score * 100

    return Math.min(Math.max(Math.round(normalizedScore), 0), 100)
  }, [prediction])

  const details = prediction
    ? prediction.details ?? diseaseDetails[predictedClass] ?? {
        tone: 'neutral',
        label: 'Prediction received',
        summary: 'Prediction received. Review the confidence score before taking action.',
        symptoms: 'No extra details are available for this class yet.',
        treatment: 'Try another clear leaf photo or confirm the result with a crop expert.',
        guidance: ['Check another leaf', 'Use good lighting', 'Confirm with an expert'],
      }
    : null

  function handleFile(file) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose a leaf image file.')
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setPrediction(null)
    setError('')
  }

  async function handlePredict() {
    if (!selectedFile) {
      setError('Upload a potato leaf image first.')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Prediction request failed')
      }

      const data = await response.json()
      setPrediction(normalizePredictionResponse(data))
    } catch {
      setError('Could not reach the prediction API. Make sure FastAPI is running on port 8000.')
    } finally {
      setIsLoading(false)
    }
  }

  function resetUpload() {
    setSelectedFile(null)
    setPreviewUrl('')
    setPrediction(null)
    setError('')
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="brand" href="#home" aria-label="PotatoCare home">
          <span className="brand-mark">P</span>
          <span>PotatoCare AI</span>
        </a>
        <div className="topbar-actions">
          <a href="#analyzer">Analyze</a>
          <a href="#insights">Insights</a>
        </div>
      </nav>

      <section className="hero-section" id="home">
        <div className="hero-content">
          <p className="eyebrow">Plant disease detection</p>
          <h1>Identify potato leaf disease with a cleaner, faster workflow.</h1>
          <p className="hero-copy">
            Upload a leaf photo and get a model-backed prediction for Early Blight,
            Late Blight, or Healthy leaves with confidence feedback.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#analyzer">
              Start analysis
            </a>
            <span className="model-pill">TensorFlow serving ready</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <img src={heroImg} alt="" />
          <div className="floating-stat stat-one">
            <strong>3</strong>
            <span>classes</span>
          </div>
          <div className="floating-stat stat-two">
            <strong>AI</strong>
            <span>screening</span>
          </div>
        </div>
      </section>

      <section className="workspace" id="analyzer">
        <div className="section-heading">
          <p className="eyebrow">Leaf analyzer</p>
          <h2>Upload a clear potato leaf image</h2>
        </div>

        <div className="analyzer-grid">
          <div
            className={`upload-panel ${isDragging ? 'is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              handleFile(event.dataTransfer.files?.[0])
            }}
          >
            <input
              id="leaf-upload"
              type="file"
              accept="image/*"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <label htmlFor="leaf-upload" className="drop-zone">
              <span className="upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path d="M12 16V5m0 0 4 4m-4-4-4 4M5 19h14" />
                </svg>
              </span>
              <strong>Drop leaf image here</strong>
              <span>or browse JPG, PNG, or WEBP files</span>
            </label>

            {selectedFile && (
              <div className="file-row">
                <div>
                  <strong>{selectedFile.name}</strong>
                  <span>{Math.max(selectedFile.size / 1024 / 1024, 0.01).toFixed(2)} MB</span>
                </div>
                <button type="button" className="ghost-button" onClick={resetUpload}>
                  Clear
                </button>
              </div>
            )}

            <button
              type="button"
              className="primary-button analyze-button"
              disabled={isLoading || !selectedFile}
              onClick={handlePredict}
            >
              {isLoading ? 'Analyzing...' : 'Predict disease'}
            </button>

            {error && <p className="error-message">{error}</p>}
          </div>

          <div className="preview-panel">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected potato leaf preview" />
            ) : (
              <div className="empty-preview">
                <span>Preview</span>
                <p>Your selected leaf image will appear here.</p>
              </div>
            )}
          </div>

          <aside className={`result-panel ${details ? details.tone : ''}`}>
            <span className="panel-label">Prediction result</span>
            {prediction ? (
              <>
                <div className="result-summary">
                  <div>
                    <span className="result-tag">{details.label}</span>
                    <h3>{predictedClass || 'Unknown prediction'}</h3>
                    <p>{details.summary}</p>
                  </div>
                  <div className="confidence-card">
                    <span>Confidence</span>
                    <strong>{confidence}%</strong>
                  </div>
                </div>
                <div className="confidence-track" aria-hidden="true">
                  <span style={{ width: `${confidence}%` }} />
                </div>
                <div className="detail-grid">
                  <section>
                    <h4>Disease details</h4>
                    <p>{details.symptoms}</p>
                  </section>
                  <section>
                    <h4>Recommended action</h4>
                    <p>{details.treatment}</p>
                  </section>
                </div>
                <div className="guidance-list" aria-label="Quick care steps">
                  {details.guidance.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3>Awaiting image</h3>
                <p>
                  Choose a focused leaf photo with natural light for the most useful
                  prediction.
                </p>
                <ul>
                  <li>Use one leaf per image</li>
                  <li>Keep the leaf centered</li>
                  <li>Avoid heavy shadows</li>
                </ul>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="insights-section" id="insights">
        <article>
          <span>01</span>
          <h3>Early Blight</h3>
          <p>Brown circular spots, often with ring patterns, usually starting on older leaves.</p>
        </article>
        <article>
          <span>02</span>
          <h3>Late Blight</h3>
          <p>Dark water-soaked patches that can expand quickly in moist weather.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Healthy</h3>
          <p>Consistent green foliage without spreading lesions or unusual discoloration.</p>
        </article>
      </section>
    </main>
  )
}

export default App
