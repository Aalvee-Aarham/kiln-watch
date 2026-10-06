import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router'
import './index.css'
import { Link } from 'react-router'
import { AppShell, ErrorBoundary, SkeletonCard, StatusMessage, useKilnsVisible, useMeta } from './components/ui'
import StoryPage from './pages/StoryPage'
import { MethodPage, ThisSeasonPage } from './pages/OtherPages'

const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))
const EvidencePage = lazy(() => import('./pages/EvidencePage'))
const KilnSeasonsPage = lazy(() => import('./pages/KilnSeasonsPage'))

function App() {
  const meta = useMeta().data
  const kilnsHidden = !useKilnsVisible()
  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<SkeletonCard label="Loading page" />}>
          <Routes>
            <Route path="/" element={<StoryPage />} />
            <Route path="/explore" element={<ExplorerPage />} />
            <Route path="/explore/box/:box" element={<ExplorerPage />} />
            <Route path="/explore/:level" element={<ExplorerPage />} />
            <Route path="/explore/:level/:unitId" element={<ExplorerPage />} />
            <Route path="/kilns/:unitId?" element={kilnsHidden ? <StatusMessage>Kiln seasons are not published for this data build (gate branch <span className="code">{meta?.gate_branch}</span>): satellites could not see the kilns. <Link className="text-orbit underline" to="/evidence">See the evidence</Link>.</StatusMessage> : <KilnSeasonsPage />} />
            <Route path="/season" element={<ThisSeasonPage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/method" element={<MethodPage />} />
            <Route path="*" element={<StatusMessage>There is no page at this address. <Link className="text-orbit underline" to="/explore">Open the explorer</Link> or go back to the <Link className="text-orbit underline" to="/">story</Link>.</StatusMessage>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><HashRouter><App /></HashRouter></StrictMode>)
