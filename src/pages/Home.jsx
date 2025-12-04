import { Outlet } from 'react-router-dom'
import Overlay from '../components/Overlay'
import SubNavBar from '../components/SubNavBar'
import styles from './Home.module.css'

const HOME_SUB_LINKS = [
  { label: 'Overview', path: '/' },
  { label: 'My stuff', path: '/my-stuff' },
]

function Home() {
  return (
    <div className={styles.wrapper}>
      <SubNavBar links={HOME_SUB_LINKS} ariaLabel="Home sub navigation" />
      <div className={styles.content}>
        <Outlet />
      </div>
      <Overlay
        className="mobile-hidden"
        points={[
          { x: 60, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 40, y: 100 },
        ]}
        zIndex={1}
      />
    </div>
  )
}

export default Home


