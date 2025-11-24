import { usePlayerTag } from '../../state/PlayerTagContext.jsx'

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
    <section>
      <form
        onSubmit={handlePlayerTagSubmit}
        style={{
          maxWidth: '320px',
          marginBottom: '2rem',
        }}
      >
        <label htmlFor="player-tag-input" className="form-label text-light">
          Player Tag
        </label>
        <input
          id="player-tag-input"
          type="text"
          className="form-control"
          placeholder="Enter your player tag (e.g. #90YY2G00)"
          value={playerTag}
          onChange={handlePlayerTagChange}
        />
        <button type="submit" className="btn btn-primary mt-2" disabled={isLoadingPlayer}>
          {isLoadingPlayer ? 'Loading...' : 'Load Player'}
        </button>
        {playerError ? (
          <div className="text-danger mt-2" style={{ fontSize: '0.85rem' }}>
            {playerError}
          </div>
        ) : null}
      </form>

      <h1>{headingText}</h1>
      <p className="lead">Your Clash Royale companion app</p>
    </section>
  )
}

export default Overview


