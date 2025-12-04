import SubNavBar from '../components/SubNavBar'
import styles from './Leaderboards.module.css'

const SUB_LINKS = [
  { label: 'Global', path: '/leaderboards/global' },
  { label: 'Friends', path: '/leaderboards/friends' },
]

function Leaderboards() {
  return (
    <section className={styles.section}>
      <div className={styles.content}>
        <SubNavBar links={SUB_LINKS} ariaLabel="Leaderboard sub navigation" />
        <div className={styles.underConstruction}>
          <div className={styles.underConstructionIcon} aria-hidden="true">
            🚧
          </div>
          <div className={styles.underConstructionCopy}>
            <p className={styles.underConstructionKicker}>Coming Soon</p>
            <h1 className={styles.underConstructionTitle}>
              Leaderboards are under construction
            </h1>
            <p className={styles.underConstructionBody}>
              We&apos;re polishing up the competition hub to make sure your stats
              look their best. Check back soon for the full experience.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Leaderboards


