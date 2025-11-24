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
  { label: 'Global', path: '/leaderboards/global' },
  { label: 'Friends', path: '/leaderboards/friends' },
]

function Leaderboards() {
  return (
    <section>
      <Overlay points={LEFT_OVERLAY_POINTS} />
      <Overlay points={RIGHT_OVERLAY_POINTS} />
      <SubNavBar links={SUB_LINKS} ariaLabel="Leaderboard sub navigation" />
      <div>
        <Outlet />
      </div>
    </section>
  )
}

export default Leaderboards


