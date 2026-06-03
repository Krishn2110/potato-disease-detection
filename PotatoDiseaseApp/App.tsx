import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat'
import { predictDisease } from './services/api'
import type { DiseaseInfo, Prediction } from './types'

const STORAGE_KEY_HISTORY = '@PotatoDiseaseApp:history'
const STORAGE_KEY_QUEUE = '@PotatoDiseaseApp:pending'

const TRANSLATIONS = {
  english: {
    appTitle: 'Potato Disease Detector',
    selectImage: 'Select Image',
    openCamera: 'Open Camera',
    uploadLeaf: 'Upload Leaf',
    disease: 'Disease',
    confidence: 'Confidence',
    symptomTitle: 'Symptoms',
    treatmentTitle: 'Treatment',
    preventionTitle: 'Prevention',
    causesTitle: 'Causes',
    pendingSync: 'Pending scans will sync when internet returns.',
    lastPredictions: 'Last 10 Predictions',
    history: 'History',
    diseaseInfo: 'Disease Info',
    home: 'Home',
    syncPending: 'Sync Pending',
    darkMode: 'Dark Mode',
    language: 'Language',
    english: 'English',
    hindi: 'Hindi',
    healthy: 'Healthy',
    earlyBlight: 'Early Blight',
    lateBlight: 'Late Blight',
    noImage: 'Choose a photo from your library or camera.',
    savedOffline: 'No connection. Scan saved offline.',
    predictionFailed: 'Prediction failed.',
    permissionDenied: 'Permission denied. Please enable permissions in settings.',
  },
  hindi: {
    appTitle: 'आलू रोग पहचान',
    selectImage: 'चित्र चुनें',
    openCamera: 'कैमरा खोलें',
    uploadLeaf: 'पत्ती अपलोड करें',
    disease: 'रोग',
    confidence: 'विश्वास',
    symptomTitle: 'लक्षण',
    treatmentTitle: 'उपचार',
    preventionTitle: 'रोकथाम',
    causesTitle: 'कारण',
    pendingSync: 'इंटरनेट आने पर पेंडिंग स्कैन सिंक होंगे।',
    lastPredictions: 'पिछले 10 भविष्यवाणियाँ',
    history: 'इतिहास',
    diseaseInfo: 'रोग जानकारी',
    home: 'होम',
    syncPending: 'पेंडिंग सिंक करें',
    darkMode: 'डार्क मोड',
    language: 'भाषा',
    english: 'अंग्रेज़ी',
    hindi: 'हिंदी',
    healthy: 'स्वस्थ',
    earlyBlight: 'अर्ली ब्लाइट',
    lateBlight: 'लेट ब्लाइट',
    noImage: 'अपने फ़ोटो लाइब्रेरी या कैमरे से चुनें।',
    savedOffline: 'कोई कनेक्शन नहीं। स्कैन ऑफलाइन सहेजा गया।',
    predictionFailed: 'भविष्यवाणी विफल।',
    permissionDenied: 'अनुमति से इनकार किया गया। सेटिंग में सक्षम करें।',
  },
} as const

const DISEASE_INFOS: Record<string, DiseaseInfo> = {
  'Early Blight': {
    tone: 'warning',
    label: 'Early Blight',
    summary: 'Common potato disease that causes brown spots and yellowing leaves.',
    symptoms: 'Brown spots on leaves, yellowing, leaf drop, rapid spread in wet weather.',
    treatment: 'Use fungicides such as mancozeb, remove infected foliage, rotate crops.',
    guidance: ['Avoid overhead watering', 'Plant resistant varieties', 'Remove infected plants'],
  },
  'Late Blight': {
    tone: 'danger',
    label: 'Late Blight',
    summary: 'Fast-spreading disease that can destroy plants and tubers quickly.',
    symptoms: 'Dark lesions on leaves, white fungal growth, rotting tubers.',
    treatment: 'Apply copper-based fungicides, destroy infected plants, keep foliage dry.',
    guidance: ['Improve air circulation', 'Avoid wet conditions', 'Inspect plants daily'],
  },
  Healthy: {
    tone: 'success',
    label: 'Healthy',
    summary: 'No sign of disease. Keep following good field hygiene.',
    symptoms: 'Green leaves, no spots, strong stems.',
    treatment: 'Continue regular care and monitoring.',
    guidance: ['Maintain balanced soil', 'Use clean seed potatoes', 'Monitor regularly'],
  },
}

type Screen = 'home' | 'info' | 'history'

type HistoryItem = {
  id: string
  imageUri: string
  predictedClass: string
  confidence: number
  date: string
  status: 'done' | 'pending'
}

export default function App() {
  const systemScheme = useColorScheme()
  const [currentScreen, setCurrentScreen] = useState<Screen>('home')
  const [language, setLanguage] = useState<'english' | 'hindi'>('english')
  const [darkMode, setDarkMode] = useState(false)
  const [imageUri, setImageUri] = useState<string | undefined>()
  const [prediction, setPrediction] = useState<Prediction | undefined>()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const strings = TRANSLATIONS[language]
  const theme = darkMode || systemScheme === 'dark' ? styles.dark : styles.light
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  })

  useEffect(() => {
    loadHistory()
    syncPendingScans()
  }, [])

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer, styles.light.background]}>
        <ActivityIndicator size="large" color="#4c8b40" />
      </View>
    )
  }

  async function loadHistory() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY_HISTORY)
      if (saved) {
        setHistory(JSON.parse(saved))
      }
      const pending = await AsyncStorage.getItem(STORAGE_KEY_QUEUE)
      if (pending) {
        const pendingItems: HistoryItem[] = JSON.parse(pending)
        setPendingCount(pendingItems.length)
      }
    } catch (error) {
      console.warn('Load history failed', error)
    }
  }

  async function saveHistory(items: HistoryItem[]) {
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(items))
  }

  async function savePendingQueue(queue: HistoryItem[]) {
    await AsyncStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue))
    setPendingCount(queue.length)
  }

  async function syncPendingScans() {
    try {
      const pending = await AsyncStorage.getItem(STORAGE_KEY_QUEUE)
      if (!pending) return
      const queue: HistoryItem[] = JSON.parse(pending)
      if (!queue.length) return

      const synced: HistoryItem[] = []
      const remaining: HistoryItem[] = []

      for (const item of queue) {
        try {
          const result = await predictDisease(item.imageUri)
          synced.push({
            ...item,
            predictedClass: result.predictedClass,
            confidence: result.confidence,
            status: 'done',
          })
        } catch {
          remaining.push(item)
        }
      }

      if (synced.length) {
        const merged = [...synced, ...history]
          .sort((a, b) => (a.date > b.date ? -1 : 1))
          .slice(0, 10)
        setHistory(merged)
        await saveHistory(merged)
      }
      await savePendingQueue(remaining)
      if (remaining.length === 0) {
        setOfflineMessage(null)
      }
    } catch (error) {
      console.warn('Pending sync failed', error)
    }
  }

  async function requestPermission(permissionRequest: () => Promise<ImagePicker.PermissionResponse>) {
    const permission = await permissionRequest()
    if (!permission.granted) {
      Alert.alert(strings.permissionDenied)
      return false
    }
    return true
  }

  async function pickImage(fromCamera: boolean) {
    try {
      const hasPermission = await requestPermission(
        fromCamera ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync,
      )
      if (!hasPermission) return

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: false })

      if (!result.cancelled) {
        setImageUri(result.assets?.[0]?.uri ?? result.uri)
        setPrediction(undefined)
        setOfflineMessage(null)
      }
    } catch (error) {
      console.warn('Pick image failed', error)
    }
  }

  async function handlePredict() {
    if (!imageUri) return
    setLoading(true)
    setOfflineMessage(null)

    const newEntryBase: HistoryItem = {
      id: Date.now().toString(),
      imageUri,
      predictedClass: strings.healthy,
      confidence: 0,
      date: new Date().toISOString(),
      status: 'done',
    }

    try {
      const result = await predictDisease(imageUri)
      setPrediction(result)
      const entry: HistoryItem = {
        ...newEntryBase,
        predictedClass: result.predictedClass,
        confidence: result.confidence,
      }
      const nextHistory = [entry, ...history].slice(0, 10)
      setHistory(nextHistory)
      await saveHistory(nextHistory)
    } catch (error) {
      const pendingEntry: HistoryItem = {
        ...newEntryBase,
        predictedClass: 'Pending',
        confidence: 0,
        status: 'pending',
      }
      const nextHistory = [pendingEntry, ...history].slice(0, 10)
      setHistory(nextHistory)
      await saveHistory(nextHistory)
      const pendingQueue = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY_QUEUE)) ?? '[]') as HistoryItem[]
      await savePendingQueue([pendingEntry, ...pendingQueue])
      setOfflineMessage(strings.savedOffline)
      Alert.alert(strings.predictionFailed)
    } finally {
      setLoading(false)
    }
  }

  function getDiseaseKey() {
    return prediction?.predictedClass ?? 'Healthy'
  }

  const diseaseInfo = DISEASE_INFOS[prediction?.predictedClass ?? 'Healthy'] ?? DISEASE_INFOS.Healthy

  return (
    <View style={[styles.container, theme.background]}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <View style={styles.header}>
        <View style={[styles.heroCard, theme.card, theme.shadow]}>
          <Text style={[styles.title, theme.text]}>{strings.appTitle}</Text>
          <Text style={[styles.subtitle, theme.text]}>Smart potato leaf scanner for fast field diagnosis.</Text>
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.smallLabel, theme.text]}>{strings.darkMode}</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} thumbColor={darkMode ? '#67d3a3' : '#ffffff'} trackColor={{ false: '#9ca3af', true: '#86efac' }} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.smallLabel, theme.text]}>{strings.language}</Text>
          <TouchableOpacity onPress={() => setLanguage(language === 'english' ? 'hindi' : 'english')} style={[styles.languageButton, theme.border]}> 
            <Text style={[styles.languageButtonText, theme.text]}>{language === 'english' ? strings.hindi : strings.english}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navRow}>
        {(['home', 'info', 'history'] as Screen[]).map((screen) => (
          <TouchableOpacity key={screen} onPress={() => setCurrentScreen(screen)} style={[styles.navButton, currentScreen === screen && styles.navButtonActive]}>
            <Text style={[styles.navText, theme.text, currentScreen === screen && styles.navTextActive]}>
              {screen === 'home' ? strings.home : screen === 'info' ? strings.diseaseInfo : strings.history}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {currentScreen === 'home' && (
          <>
            <View style={styles.imageSection}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.preview} />
              ) : (
                <View style={[styles.previewPlaceholder, theme.border]}>
                  <Text style={[styles.placeholderText, theme.text]}>{strings.noImage}</Text>
                </View>
              )}
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.secondaryButton, theme.button, styles.buttonMargin]} onPress={() => pickImage(false)}>
                <Text style={[styles.buttonLabel, theme.buttonText]}>{strings.selectImage}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, theme.button]} onPress={() => pickImage(true)}>
                <Text style={[styles.buttonLabel, theme.buttonText]}>{strings.openCamera}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.primaryButton, theme.button, (!imageUri || loading) && styles.disabledButton]} onPress={handlePredict} disabled={!imageUri || loading}>
              {loading ? <ActivityIndicator color={darkMode ? '#111827' : '#ffffff'} /> : <Text style={[styles.buttonLabel, theme.buttonText]}>{strings.uploadLeaf}</Text>}
            </TouchableOpacity>

            {offlineMessage ? <Text style={[styles.offlineText, theme.text]}>{offlineMessage}</Text> : null}

            {prediction ? (
              <View style={[styles.resultPanel, theme.card, theme.shadow]}>
                <Text style={[styles.resultHeading, theme.text]}>Prediction</Text>
                <View style={styles.resultRow}>
                  <View style={[styles.resultStat, theme.card]}>
                    <Text style={[styles.resultLabel, theme.text]}>{strings.disease}</Text>
                    <Text style={[styles.resultNumber, theme.text]}>{prediction.predictedClass}</Text>
                  </View>
                  <View style={[styles.resultStat, theme.card]}>
                    <Text style={[styles.resultLabel, theme.text]}>{strings.confidence}</Text>
                    <Text style={[styles.resultNumber, theme.text]}>{Math.round(prediction.confidence * 100)}%</Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={[styles.infoCard, theme.card]}>
              <Text style={[styles.infoTitle, theme.text]}>{diseaseInfo.label}</Text>
              <Text style={[styles.infoText, theme.text]}>{diseaseInfo.summary}</Text>
              <Text style={[styles.subheading, theme.text]}>{strings.symptomTitle}:</Text>
              <Text style={[styles.infoText, theme.text]}>{diseaseInfo.symptoms}</Text>
              <Text style={[styles.subheading, theme.text]}>{strings.treatmentTitle}:</Text>
              <Text style={[styles.infoText, theme.text]}>{diseaseInfo.treatment}</Text>
            </View>
          </>
        )}

        {currentScreen === 'info' && (
          <View style={[styles.infoCard, theme.card]}>
            <Text style={[styles.infoTitle, theme.text]}>{diseaseInfo.label}</Text>
            <Text style={[styles.infoText, theme.text]}>{diseaseInfo.summary}</Text>
            <Text style={[styles.subheading, theme.text]}>{strings.symptomTitle}:</Text>
            <Text style={[styles.infoText, theme.text]}>{diseaseInfo.symptoms}</Text>
            <Text style={[styles.subheading, theme.text]}>{strings.causesTitle}:</Text>
            <Text style={[styles.infoText, theme.text]}>{diseaseInfo.guidance.join(', ')}</Text>
            <Text style={[styles.subheading, theme.text]}>{strings.preventionTitle}:</Text>
            <Text style={[styles.infoText, theme.text]}>Keep plants dry, rotate crops, and use clean seed.</Text>
            <Text style={[styles.subheading, theme.text]}>{strings.treatmentTitle}:</Text>
            <Text style={[styles.infoText, theme.text]}>{diseaseInfo.treatment}</Text>
          </View>
        )}

        {currentScreen === 'history' && (
          <View>
            <Text style={[styles.sectionTitle, theme.text]}>{strings.lastPredictions}</Text>
            {history.length === 0 ? (
              <Text style={[styles.infoText, theme.text]}>{strings.noImage}</Text>
            ) : (
              history.map((item) => (
                <View key={item.id} style={[styles.historyItem, theme.card]}>
                  <Image source={{ uri: item.imageUri }} style={styles.historyImage} />
                  <View style={styles.historyText}>
                    <Text style={[styles.historyLabel, theme.text]}>{item.predictedClass}</Text>
                    <Text style={[styles.historySmall, theme.text]}>({item.status === 'pending' ? 'Pending' : `${Math.round(item.confidence * 100)}%`})</Text>
                    <Text style={[styles.historyTime, theme.text]}>{new Date(item.date).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            )}
            {pendingCount > 0 && (
              <TouchableOpacity style={[styles.button, theme.button]} onPress={syncPendingScans}>
                <Text style={[styles.buttonText, theme.buttonText]}>{strings.syncPending} ({pendingCount})</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const baseColors = {
  light: {
    background: '#f7f9f3',
    card: '#ffffff',
    text: '#1f2937',
    border: '#d1d5db',
    button: '#4c8b40',
    buttonText: '#ffffff',
  },
  dark: {
    background: '#121212',
    card: '#1f1f1f',
    text: '#f9fafb',
    border: '#374151',
    button: '#67d3a3',
    buttonText: '#111827',
  },
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Montserrat_700Bold',
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    lineHeight: 24,
    color: '#6b7280',
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 0,
  },
  resultHeading: {
    fontSize: 17,
    fontFamily: 'Montserrat_700Bold',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  resultStat: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: {
    fontSize: 13,
    fontFamily: 'Montserrat_600SemiBold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultNumber: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  smallLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
  },
  languageButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  languageButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonActive: {
    borderColor: '#4c8b40',
    backgroundColor: '#4c8b40',
  },
  navText: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
  },
  navTextActive: {
    color: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    marginBottom: 12,
  },
  previewPlaceholder: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  placeholderText: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  secondaryButton: {
    flex: 1,
    marginBottom: 0,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMargin: {
    marginRight: 12,
  },
  primaryButton: {
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
  },
  disabledButton: {
    opacity: 0.64,
  },
  resultPanel: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 19,
    fontFamily: 'Montserrat_700Bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    fontFamily: 'Montserrat_400Regular',
    lineHeight: 22,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 15,
    fontFamily: 'Montserrat_600SemiBold',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  historyImage: {
    width: 90,
    height: 90,
  },
  historyText: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  historyLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
  },
  historySmall: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    marginTop: 4,
  },
  historyTime: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    marginTop: 6,
  },
  offlineText: {
    textAlign: 'center',
    marginBottom: 14,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  light: {
    background: { backgroundColor: baseColors.light.background },
    text: { color: baseColors.light.text, fontFamily: 'Montserrat_400Regular' },
    card: { backgroundColor: baseColors.light.card, borderColor: baseColors.light.border, borderWidth: 1 },
    button: { backgroundColor: baseColors.light.button },
    buttonText: { color: baseColors.light.buttonText, fontFamily: 'Montserrat_700Bold' },
    border: { borderColor: baseColors.light.border },
  },
  dark: {
    background: { backgroundColor: baseColors.dark.background },
    text: { color: baseColors.dark.text, fontFamily: 'Montserrat_400Regular' },
    card: { backgroundColor: baseColors.dark.card, borderColor: baseColors.dark.border, borderWidth: 1 },
    button: { backgroundColor: baseColors.dark.button },
    buttonText: { color: baseColors.dark.buttonText, fontFamily: 'Montserrat_700Bold' },
    border: { borderColor: baseColors.dark.border },
  },
})
