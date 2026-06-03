export type DiseaseClass = 'Early Blight' | 'Late Blight' | 'Healthy'

export type Prediction = {
  predictedClass: DiseaseClass | string
  confidence: number
}

export type DiseaseInfo = {
  tone: 'warning' | 'danger' | 'success' | 'neutral'
  label: string
  summary: string
  symptoms: string
  treatment: string
  guidance: string[]
}
