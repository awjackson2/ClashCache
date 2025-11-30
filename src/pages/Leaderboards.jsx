import { Outlet } from 'react-router-dom'
import Overlay from '../components/Overlay'
import SubNavBar from '../components/SubNavBar'
import leaderboardImage from '../assets/Left-Leader-Board.png'
import leaderboardImage2 from '../assets/Right-Leader-Board.png'
import styles from './Leaderboards.module.css'

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
    <section className={styles.section}>
      <div className={styles.background}>
        <div className={styles.panel}>
          <img
            src={leaderboardImage}
            alt="Leaderboard"
            className={`${styles.image} ${styles.imageLeft} mobile-hidden`}
          />
          <Overlay className="mobile-hidden" points={LEFT_OVERLAY_POINTS} />
        </div>
        <div className={styles.panel}>
          <img
            src={leaderboardImage2}
            alt="Leaderboard 2"
            className={`${styles.image} ${styles.imageRight} mobile-hidden`}
          />
          <Overlay className="mobile-hidden" points={RIGHT_OVERLAY_POINTS} />
        </div>
      </div>
      <div className={styles.content}>
        <SubNavBar links={SUB_LINKS} ariaLabel="Leaderboard sub navigation" />
        <div className={styles.outlet}>
          <Outlet />
        </div>
      </div>
    </section>
  )
}

export default Leaderboards


