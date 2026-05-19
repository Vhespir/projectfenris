import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { useAuth } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Community from './pages/Community'
import Compendium from './pages/Compendium'
import GuideDetail from './pages/GuideDetail'
import Tools from './pages/Tools'
import Register from './pages/Register'
import Login from './pages/Login'
import Post from './pages/Post'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import NotFound, { ServerError, Forbidden, Maintenance } from './pages/errors/NotFound'
import About from './pages/About'
import Onboarding from './pages/Onboarding'
import Search from './pages/Search'
import Mod from './pages/Mod'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Inbox from './pages/Inbox'
import AfterAction, { AARDetail } from './pages/AfterAction'
import Frequencies from './pages/Frequencies'
import EventThread from './pages/EventThread'
import { SocketProvider } from './context/SocketContext'
import { ContextDrawerProvider } from './context/ContextDrawerContext'
import { ContextDrawer } from './components/ContextDrawer'

function ProfileRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/profile/${user.username}`} replace />
}

function App() {
  return (
    <SocketProvider>
    <ContextDrawerProvider>
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/map" element={<Map />} />
          <Route path="/community" element={<Community />} />
          <Route path="/compendium" element={<Compendium />} />
          <Route path="/compendium/:id" element={<GuideDetail />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile" element={<ProfileRedirect />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/search" element={<Search />} />
          <Route path="/mod" element={<Mod />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/inbox/:username" element={<Inbox />} />
          <Route path="/aar" element={<AfterAction />} />
          <Route path="/aar/:id" element={<AARDetail />} />
          <Route path="/frequencies" element={<Frequencies />} />
          <Route path="/event/:slug" element={<EventThread />} />
          <Route path="/500" element={<ServerError />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/503" element={<Maintenance />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ContextDrawer />
    </div>
    </ContextDrawerProvider>
    </SocketProvider>
  )
}

export default App
