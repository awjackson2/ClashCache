import { usePlayerTag } from '../../state/PlayerTagContext.jsx'
import heroImage from '../../assets/Blue-Kings-Jumping.png'
import styles from './Overview.module.css'

function Overview() {
  const {
    playerTag,
    setPlayerTag,
    currentPlayer,
    isLoadingPlayer,
    playerError,
    loadPlayerForTag,
  } = usePlayerTag()

  const handlePlayerTagChange = (event) => {
    setPlayerTag(event.target.value)
  }

  const handlePlayerTagSubmit = (event) => {
    event.preventDefault()
    loadPlayerForTag(playerTag)
  }

  const headingText = currentPlayer?.name
    ? `Welcome ${currentPlayer.name}`
    : 'Welcome to Clash Cache'

  return (
    <section className={`${styles.section}`}>
      <div className={styles.contentColumn}>
        <div className={styles.contentInner}>
          <h1 className={styles.heading}>{headingText}</h1>
          <p className={styles.lead}>Your Clash Royale companion app</p>
          <form onSubmit={handlePlayerTagSubmit} className={styles.form}>
            <label htmlFor="player-tag-input" className={styles.label}>
              Player Tag
            </label>
            <input
              id="player-tag-input"
              type="text"
              className={styles.input}
              placeholder="Enter your player tag (e.g. #90YY2G00)"
              value={playerTag}
              onChange={handlePlayerTagChange}
            />
            <button type="submit" className={styles.submitButton} disabled={isLoadingPlayer}>
              {isLoadingPlayer ? 'Loading...' : 'Load Player'}
            </button>
            {playerError ? (
              <div className={styles.error}>
                {playerError}
              </div>
            ) : null}
          </form>
        </div>
      </div>
      <div className={`${styles.heroColumn} mobile-hidden`}>
        <img src={heroImage} alt="Blue King jumping into battle" className={`${styles.heroImage}`} />
      </div>
    </section>
  )
}

export default Overview


