import { Outlet } from 'react-router-dom'
import Overlay from '../components/Overlay'
import SubNavBar from '../components/SubNavBar'

const RIGHT_OVERLAY_POINTS = [
  { x: 60, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 133.3333 },
]

const LEFT_OVERLAY_POINTS = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 0, y: 133.3333 },
]

const SUB_LINKS = [
  { label: 'Explore', path: '/decks/explore' },
  { label: 'Build', path: '/decks/build' },
  { label: 'Cache', path: '/decks/cache' },
]

function Decks() {
  return (
    <section style={{ paddingTop: '80px' }}>
      <SubNavBar links={SUB_LINKS} ariaLabel="Decks sub navigation" />
      <div>
        <Outlet />
      </div>
    </section>
  )
}

export default Decks


