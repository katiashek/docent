import { create } from 'zustand'
import { supabase } from '../supabase.js'
import { DEFAULT_VOICE_ID, FREE_VOICE_IDS } from '../services/elevenlabs.js'

export const TASTE_PROFILE_THRESHOLD = 10
export const PHASE_II_THRESHOLD = 15
export const PROFILE_REFRESH_INTERVAL = 10

export const useAppState = create((set, get) => ({
  user: null,
  llmConfig: { provider: 'anthropic', apiKey: '' },
  elevenLabsConfig: { apiKey: '', voiceId: '21m00Tcm4TlvDq8ikWAM' }, // Rachel — free-tier default
  onboardingData: {
    styles: [],
    artists: '',
    themes: [],
    decadeRange: [1800, 1960],
    regions: [],
    mediums: [],
    freetext: '',
    familiarity: null,
  },
  tasteProfile: null,
  swipeHistory: [],
  swipePhase: 'variety',
  bookmarks: new Set(),
  journalNotes: {},
  tourIntent: {
    minutes: 60,
    mode: 'taste',
    focusText: '',
    avoidText: '',
  },
  itinerary: null,
  savedTours: [],

  setUser: (user) => set({ user }),
  setLlmConfig: (llmConfig) => set({ llmConfig }),
  setElevenLabsConfig: (elevenLabsConfig) => set({ elevenLabsConfig }),

  setOnboardingData: (updates) =>
    set((s) => ({ onboardingData: { ...s.onboardingData, ...updates } })),

  setTasteProfile: (tasteProfile) => set({ tasteProfile }),

  addSwipe: (entry) =>
    set((s) => {
      const history = [...s.swipeHistory, entry]
      const phase = history.length >= PHASE_II_THRESHOLD ? 'drill' : 'variety'
      return { swipeHistory: history, swipePhase: phase }
    }),

  removeLastSwipe: () =>
    set((s) => {
      const history = s.swipeHistory.slice(0, -1)
      const phase = history.length >= PHASE_II_THRESHOLD ? 'drill' : 'variety'
      return { swipeHistory: history, swipePhase: phase }
    }),

  setTourIntent: (updates) =>
    set((s) => ({ tourIntent: { ...s.tourIntent, ...updates } })),

  setItinerary: (itinerary) => set({ itinerary }),

  saveTour: async () => {
    const { itinerary, savedTours, user } = get()
    if (!itinerary) return
    const tour = { ...itinerary, savedAt: Date.now() }
    const already = savedTours.some((t) => t.builtAt === tour.builtAt)
    if (already) return
    set({ savedTours: [...savedTours, tour] })
    if (user) {
      await supabase.from('saved_tours').upsert({
        user_id: user.id,
        tour_data: tour,
        built_at: tour.builtAt,
      })
    }
  },

  deleteStop: (stopId) => set((s) => {
    if (!s.itinerary) return {}
    const stops = s.itinerary.stops.map((group) => ({
      ...group,
      stops: group.stops.filter((stop) => stop.id !== stopId),
    })).filter((group) => group.stops.length > 0)
    return { itinerary: { ...s.itinerary, stops } }
  }),

  addStopToItinerary: (stop) => set((s) => {
    if (!s.itinerary) return {}
    const existing = s.itinerary.stops.flatMap((g) => g.stops).find((st) => st.id === stop.id)
    if (existing) return {}
    const galleryKey = stop.gallery || 'Additional Stops'
    const existingGroup = s.itinerary.stops.find((g) => g.gallery === galleryKey)
    let stops
    if (existingGroup) {
      stops = s.itinerary.stops.map((g) =>
        g.gallery === galleryKey ? { ...g, stops: [...g.stops, stop] } : g
      )
    } else {
      stops = [...s.itinerary.stops, { gallery: galleryKey, floor: stop.floor || 1, stops: [stop] }]
    }
    return { itinerary: { ...s.itinerary, stops } }
  }),

  toggleBookmark: async (artworkId, artworkData) => {
    const { bookmarks, user } = get()
    const next = new Set(bookmarks)
    if (next.has(artworkId)) {
      next.delete(artworkId)
      if (user) {
        await supabase.from('bookmarks').delete().match({ user_id: user.id, artwork_id: artworkId })
      }
    } else {
      next.add(artworkId)
      if (user) {
        await supabase.from('bookmarks').upsert({
          user_id: user.id,
          artwork_id: String(artworkId),
          artwork_data: artworkData,
          visited: false,
        })
      }
    }
    set({ bookmarks: next })
  },

  saveJournalNote: async (artworkId, artworkTitle, artworkData, text) => {
    const { user, journalNotes } = get()
    const entry = { text, timestamp: Date.now(), artworkTitle }
    const next = { ...journalNotes, [artworkId]: entry }
    set({ journalNotes: next })
    if (user) {
      await supabase.from('journal_notes').upsert({
        user_id: user.id,
        artwork_id: String(artworkId),
        artwork_title: artworkTitle,
        artwork_data: artworkData,
        note_text: text,
        updated_at: new Date().toISOString(),
      })
    }
  },

  resetForNewTour: () => set({
    tasteProfile: null,
    swipeHistory: [],
    swipePhase: 'variety',
    itinerary: null,
    onboardingData: {
      styles: [],
      artists: '',
      themes: [],
      decadeRange: [1800, 1960],
      regions: [],
      mediums: [],
      freetext: '',
      familiarity: null,
    },
  }),

  loadUserData: async (userId) => {
    const [profileRes, bookmarksRes, journalRes, toursRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('bookmarks').select('*').eq('user_id', userId),
      supabase.from('journal_notes').select('*').eq('user_id', userId),
      supabase.from('saved_tours').select('*').eq('user_id', userId).order('saved_at', { ascending: false }),
    ])
    const profile = profileRes.data
    if (profile) {
      const rawConfig = profile.llm_config
        || (profile.anthropic_api_key ? { provider: 'anthropic', apiKey: profile.anthropic_api_key } : get().llmConfig)
      const llmConfig = { provider: rawConfig.provider || 'anthropic', apiKey: rawConfig.apiKey || '' }
      const savedVoiceId = rawConfig.elevenLabsVoiceId || get().elevenLabsConfig.voiceId
      const elevenLabsConfig = {
        apiKey: rawConfig.elevenLabsKey || get().elevenLabsConfig.apiKey,
        // Reset stale/paid voice IDs that are no longer in the free-tier list
        voiceId: FREE_VOICE_IDS.has(savedVoiceId) ? savedVoiceId : DEFAULT_VOICE_ID,
      }
      set({
        llmConfig,
        elevenLabsConfig,
        tasteProfile: profile.taste_profile || null,
        onboardingData: profile.onboarding_data || get().onboardingData,
        swipeHistory: profile.swipe_history || [],
        itinerary: profile.itinerary || null,
      })
    }
    if (bookmarksRes.data) {
      set({ bookmarks: new Set(bookmarksRes.data.map((b) => b.artwork_id)) })
    }
    if (journalRes.data) {
      const notes = {}
      journalRes.data.forEach((n) => {
        notes[n.artwork_id] = { text: n.note_text, timestamp: new Date(n.updated_at).getTime(), artworkTitle: n.artwork_title }
      })
      set({ journalNotes: notes })
    }
    if (toursRes.data) {
      set({ savedTours: toursRes.data.map((r) => r.tour_data) })
    }
  },
}))
