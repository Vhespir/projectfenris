import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import Map from './pages/Map'
import Feed from './pages/Feed'
import Community from './pages/Community'
import Register from './pages/Register'
import Login from './pages/Login'
import Post from './pages/Post'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import NotFound, { ServerError, Forbidden, Maintenance } from './pages/errors/NotFound'
import About from './pages/About'

function ProfileRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/profile/${user.username}`} replace />
}

function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<Map />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/community" element={<Community />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/profile" element={<ProfileRedirect />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route path="/500" element={<ServerError />} />
          <Route path="/403" element={<Forbidden />} />
          <Route path="/503" element={<Maintenance />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
