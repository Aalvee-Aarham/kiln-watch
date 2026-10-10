import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router'
import './index.css'
import { Link } from 'react-router'
import { AppShell, ErrorBoundary, SkeletonCard, StatusMessage, useKilnsVisible, useMeta } from './components/ui'
import HomePage from './pages/HomePage'
import { MethodPage, ThisSeasonPage } from './pages/OtherPages'

// Plain-language pages (redesign_plan.md) and the original expert pages, which keep their routes so shared links still work.
const AreaPage = lazy(() => import('./pages/AreaPage'))
const KilnPlannerPage = lazy(() => import('./pages/KilnPlannerPage'))
const SensorsPage = lazy(() => import('./pages/SensorsPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const ImpactPage = lazy(() => import('./pages/ImpactPage'))
const HowPage = lazy(() => import('./pages/HowPage'))
const TrustPage = lazy(() => import('./pages/TrustPage'))
const ExpertsPage = lazy(() => import('./pages/ExpertsPage'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))
const EvidencePage = lazy(() => import('./pages/EvidencePage'))
const KilnSeasonsPage = lazy(() => import('./pages/KilnSeasonsPage'))
const AskPage = lazy(() => import('./pages/AskPage'))

function App() {
  const meta = useMeta().data
  const kilnsHidden = !useKilnsVisible()
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<SkeletonCard label="Loading page" />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/area/:unitId?" element={<AreaPage />} />
            <Route path="/kilns/:unitId?" element={<KilnPlannerPage />} />
            <Route path="/sensors" element={<SensorsPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/how" element={<HowPage />} />
            <Route path="/impact/:who?/:unitId?" element={<ImpactPage />} />
            <Route path="/trust" element={<TrustPage />} />
            <Route path="/experts" element={<ExpertsPage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/story" element={<StoryPage />} />
            <Route path="/explore" element={<ExplorerPage />} />
            <Route path="/explore/box/:box" element={<ExplorerPage />} />
            <Route path="/explore/:level" element={<ExplorerPage />} />
            <Route path="/explore/:level/:unitId" element={<ExplorerPage />} />
            <Route path="/experts/kilns/:unitId?" element={kilnsHidden ? <StatusMessage>Kiln seasons are not published for this data build (gate branch <span className="code">{meta?.gate_branch}</span>): satellites could not see the kilns. <Link className="text-orbit underline" to="/evidence">See the evidence</Link>.</StatusMessage> : <KilnSeasonsPage />} />
            <Route path="/season" element={<ThisSeasonPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/method" element={<MethodPage />} />
            <Route path="*" element={<StatusMessage>There is no page at this address. <Link className="text-orbit underline" to="/area">Check your area</Link> or go back <Link className="text-orbit underline" to="/">home</Link>.</StatusMessage>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><App /></HashRouter></StrictMode>)
