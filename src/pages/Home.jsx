import { Container } from 'react-bootstrap'
import { Outlet } from 'react-router-dom'
import Overlay from '../components/Overlay'
import SubNavBar from '../components/SubNavBar'

const HOME_SUB_LINKS = [
  { label: 'Overview', path: '/' },
  { label: 'My stuff', path: '/my-stuff' },
]

function Home() {
  return (
    <Container style={{ position: 'relative', minHeight: 'calc(100vh - 80px)', paddingTop: '80px' }}>
      {/* Sub-navbar for Home subpages */}
      <SubNavBar links={HOME_SUB_LINKS} ariaLabel="Home sub navigation" />

      {/* Home subpage content */}
      <Outlet />

      <Overlay points={[{ x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 40, y: 100 }]} />
    </Container>
  )
}

export default Home


