import { useEffect, useState, useRef } from 'react'
import { T } from './tokens.js'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { useAppState } from './state/useAppState.js'
import BottomNav from './components/BottomNav.jsx'
import Landing from './views/Landing.jsx'
import WelcomeBack from './views/WelcomeBack.jsx'
import OnboardingFlow from './views/OnboardingFlow.jsx'
import Swipe from './views/Swipe.jsx'
import TasteProfile from './views/TasteProfile.jsx'
import TourIntent from './views/TourIntent.jsx'
import Planner from './views/Planner.jsx'
import Guide from './views/Guide.jsx'
import Profile from './views/Profile.jsx'
import Settings from './views/Settings.jsx'

export default function App() {
  const { user, setUser, loadUserData, tasteProfile, itinerary } = useAppState()
  const [screen, setScreen] = useState('loading') // loading | landing | onboarding | main
  const [activeTab, setActiveTab] = useState('discover') // discover | tour | saved
  const [discoverView, setDiscoverView] = useState('swipe') // swipe | profile | intent
  const [tourView, setTourView] = useState('planner') // planner | guide
  const [currentStop, setCurrentStop] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  // Prevents handleAuthUser (triggered by token refreshes) from re-routing after explicit navigation
  const onboardingDoneRef = useRef(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No Supabase — run in demo mode, skip auth
      setScreen('onboarding')
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthUser(session.user)
      } else {
        setScreen('landing')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        handleAuthUser(session.user)
      } else if (event === 'SIGNED_OUT') {
        setScreen('landing')
        onboardingDoneRef.current = false
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleAuthUser(authUser) {
    setUser(authUser)
    await loadUserData(authUser.id).catch(() => {})
    if (onboardingDoneRef.current) return
    const { tasteProfile: tp, itinerary: itin } = useAppState.getState()
    if (tp) {
      if (itin?.stops?.length > 0) {
        setScreen('returning')
      } else {
        setScreen('main')
      }
      // Lock after first successful routing so token refreshes don't re-route mid-session
      onboardingDoneRef.current = true
    } else {
      setScreen('onboarding')
      // Leave ref false — handleOnboardingComplete will set it when the user finishes
    }
  }

  function handleOnboardingComplete(destination) {
    onboardingDoneRef.current = true
    const { user: appUser, tasteProfile: tp, onboardingData: od } = useAppState.getState()
    try {
      if (appUser && isSupabaseConfigured) {
        supabase.from('profiles').upsert({
          id: appUser.id,
          taste_profile: tp || { onboardingCompleted: true },
          onboarding_data: od,
          updated_at: new Date().toISOString(),
        }).then(() => {}, () => {})
      }
    } catch {}
    setScreen('main')
    if (destination === 'tour') {
      setActiveTab('tour')
      setTourView('intent')
    } else {
      setActiveTab('discover')
    }
  }

  function handleSelectStop(stop) {
    setCurrentStop(stop)
    setTourView('guide')
    setActiveTab('tour')
  }

  function handleNavigate(dest) {
    if (dest === 'discover') {
      setActiveTab('discover')
      setDiscoverView('swipe')
    } else if (dest === 'intent') {
      setActiveTab('tour')
      setTourView('intent')
    } else if (dest === 'profile') {
      setDiscoverView('profile')
    } else if (dest === 'tour') {
      setActiveTab('tour')
      setTourView('planner')
    }
  }

  const allStops = itinerary?.stops?.flatMap((g) => g.stops) || []

  if (screen === 'loading') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg }}>
        <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 500, color: T.accent }}>docent</div>
      </div>
    )
  }

  if (screen === 'returning') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <WelcomeBack
          onContinue={() => { setScreen('main'); setActiveTab('tour'); setTourView('planner') }}
          onRebuild={() => {
            useAppState.getState().setItinerary(null)
            if (user && isSupabaseConfigured) {
              supabase.from('profiles').upsert({
                id: user.id,
                itinerary: null,
                updated_at: new Date().toISOString(),
              }).then(() => {}, () => {})
            }
            setScreen('main'); setActiveTab('tour'); setTourView('intent')
          }}
          onScratch={() => {
            useAppState.getState().resetForNewTour()
            if (user && isSupabaseConfigured) {
              supabase.from('profiles').upsert({
                id: user.id,
                taste_profile: null,
                itinerary: null,
                swipe_history: [],
                updated_at: new Date().toISOString(),
              }).then(() => {}, () => {})
            }
            setScreen('onboarding')
          }}
        />
      </div>
    )
  }

  if (screen === 'landing') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <Landing onAuth={(u) => { setUser(u); setScreen('onboarding') }} />
      </div>
    )
  }

  if (screen === 'onboarding') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {showSettings ? (
          <Settings
            onBack={() => { setShowSettings(false); setActiveTab('discover') }}
            onSignOut={() => { setScreen('landing'); setShowSettings(false) }}
          />
        ) : activeTab === 'discover' ? (
          discoverView === 'swipe' ? (
            <Swipe onNavigate={(d) => { if (d === 'intent') { setActiveTab('tour'); setTourView('intent') } else setDiscoverView(d) }} />
          ) : (
            <TasteProfile onNavigate={(d) => { if (d === 'intent') { setActiveTab('tour'); setTourView('intent') } }} />
          )
        ) : activeTab === 'tour' ? (
          tourView === 'planner' ? (
            <Planner onSelectStop={handleSelectStop} onNavigate={(d) => { if (d === 'intent') setTourView('intent') }} />
          ) : tourView === 'intent' ? (
            <TourIntent onBuild={() => setTourView('planner')} />
          ) : currentStop ? (
            <Guide
              stop={currentStop}
              allStops={allStops}
              onGoTo={(s) => setCurrentStop(s)}
              onBack={() => setTourView('planner')}
            />
          ) : null
        ) : activeTab === 'saved' ? (
          <Profile onResumeTour={(tour) => {
            useAppState.getState().setItinerary(tour)
            setActiveTab('tour')
            setTourView('planner')
          }} />
        ) : null}

        {/* Settings gear — hidden in guide and when settings is open */}
        {!showSettings && !(activeTab === 'tour' && tourView === 'guide') && (
          <button
            onClick={() => setShowSettings(true)}
            style={{
              position: 'absolute', top: 14, right: 20,
              width: 32, height: 32, borderRadius: '50%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill={T.ink3}>
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
          </button>
        )}
      </div>

      {/* Bottom nav — hide only in guide view */}
      {!(activeTab === 'tour' && tourView === 'guide') && (
        <BottomNav
          active={showSettings ? '' : activeTab}
          onNavigate={(tab) => { setShowSettings(false); setActiveTab(tab) }}
        />
      )}
    </div>
  )
}
