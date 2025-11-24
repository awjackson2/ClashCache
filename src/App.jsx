import { Routes, Route } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import NavBar from './components/NavBar'
import Home from './pages/Home'
import Overview from './pages/home/Overview'
import MyStuff from './pages/home/MyStuff'
import Leaderboards from './pages/Leaderboards'
import Decks from './pages/Decks'
import GlobalRanks from './pages/leaderboards/GlobalRanks'
import FriendsRanks from './pages/leaderboards/FriendsRanks'
import Explore from './pages/decks/Explore'
import Build from './pages/decks/Build'
import Cache from './pages/decks/Cache'

function App() {
  return (
    <>
      <NavBar />
      <Container fluid className="px-0">
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<Overview />} />
            <Route path="my-stuff" element={<MyStuff />} />
          </Route>
          <Route path="/decks" element={<Decks />}>
            <Route index element={<Explore />} />
            <Route path="explore" element={<Explore />} />
            <Route path="build" element={<Build />} />
            <Route path="cache" element={<Cache />} />
          </Route>
          <Route path="/leaderboards" element={<Leaderboards />}>
            <Route index element={<GlobalRanks />} />
            <Route path="global" element={<GlobalRanks />} />
            <Route path="friends" element={<FriendsRanks />} />
          </Route>
        </Routes>
      </Container>
    </>
  )
}

export default App

