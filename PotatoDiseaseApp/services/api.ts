import type { Prediction } from '../types'

const API_BASE_URL = 'https://potato-disease-detection-production.up.railway.app'

const CLASS_NAMES = ['Early Blight', 'Late Blight', 'Healthy']

function normalizeClassName(value: unknown): string {
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

function normalizePredictionResponse(data: any): Prediction {
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

  const numericConfidence = Number(confidence ?? 0)

  return {
    predictedClass,
    confidence: numericConfidence > 1 ? numericConfidence / 100 : numericConfidence,
  }
}

export async function predictDisease(imageUri: string): Promise<Prediction> {
  const fileName = imageUri.split('/').pop() ?? 'leaf.jpg'
  const extension = fileName.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg'

  const formData = new FormData()
  formData.append('file', {
    uri: imageUri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob)

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Prediction failed with status ${response.status}`)
  }

  const data = await response.json()
  return normalizePredictionResponse(data)
}
