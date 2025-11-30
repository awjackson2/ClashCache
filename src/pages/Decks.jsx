import { Outlet } from 'react-router-dom'
import Overlay from '../components/Overlay'
import SubNavBar from '../components/SubNavBar'
import styles from './Decks.module.css'

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
    <section className={styles.section}>
      <SubNavBar links={SUB_LINKS} ariaLabel="Decks sub navigation" />
      <div className={styles.content}>
        <Outlet />
      </div>
      <Overlay points={LEFT_OVERLAY_POINTS} className={`${styles.overlay} mobile-hidden`} />
      <Overlay points={RIGHT_OVERLAY_POINTS} className={`${styles.overlay} mobile-hidden`} />
    </section>
  )
}

export default Decks


