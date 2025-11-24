import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import styles from './Overlay.module.css'

const DEFAULT_POINTS = [
  { x: 62.5, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 62.5, y: 100 },
]

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const formatCoordinate = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}%`
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  return '0%'
}

const formatLength = (value) => {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`
  }
  return value
}

const resolvePoints = (points) => {
  if (Array.isArray(points) && points.length > 0) {
    return points
  }
  return DEFAULT_POINTS
}

function Overlay({
  points,
  color,
  backgroundColor,
  opacity = 1,
  zIndex,
  initialPosition,
  position = 'fixed',
  width = '100%',
  height = '100%',
  isVisible = true,
  className,
  style,
  children,
  portalTarget,
  ...rest
}) {
  const polygonPoints = resolvePoints(points)
  const clipPath = useMemo(() => {
    const path = polygonPoints
      .map((point) => {
        const x = formatCoordinate(point?.x)
        const y = formatCoordinate(point?.y)
        return `${x} ${y}`
      })
      .join(', ')
    return `polygon(${path})`
  }, [polygonPoints])

  if (!isVisible) {
    return null
  }

  const resolvedColor = backgroundColor || color || 'var(--overlay-bg)'
  const resolvedOpacity = clamp(typeof opacity === 'number' ? opacity : 1, 0, 1)

  const positionStyle = {}
  if (initialPosition?.x !== undefined) {
    positionStyle.left = formatLength(initialPosition.x)
  }
  if (initialPosition?.y !== undefined) {
    positionStyle.top = formatLength(initialPosition.y)
  }

  const overlayStyle = {
    '--overlay-clip': clipPath,
    '--overlay-z': zIndex ?? 1,
    '--overlay-opacity': resolvedOpacity,
    position,
    width: formatLength(width) ?? '100%',
    height: formatLength(height) ?? '100%',
    overflow: 'hidden',
    backgroundColor: resolvedColor,
    clipPath,
    WebkitClipPath: clipPath,
    opacity: resolvedOpacity,
    ...positionStyle,
    ...style,
  }

  const overlayNode = (
    <div className={styles.overlayRoot}>
      <div
        className={[styles.overlay, className].filter(Boolean).join(' ')}
        style={overlayStyle}
        aria-hidden="true"
        role="presentation"
        {...rest}
      >
        <div className={styles.overlayContent}>{children}</div>
      </div>
    </div>
  )

  const resolvedPortalTarget = portalTarget ?? (typeof document !== 'undefined' ? document.body : null)

  if (resolvedPortalTarget) {
    return createPortal(overlayNode, resolvedPortalTarget)
  }

  return overlayNode
}

Overlay.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    })
  ),
  color: PropTypes.string,
  backgroundColor: PropTypes.string,
  opacity: PropTypes.number,
  zIndex: PropTypes.number,
  initialPosition: PropTypes.shape({
    x: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    y: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  position: PropTypes.oneOf(['absolute', 'fixed', 'relative']),
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isVisible: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
  portalTarget: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
}

Overlay.defaultProps = {
  points: DEFAULT_POINTS,
  opacity: 1,
  position: 'fixed',
  width: '100%',
  height: '100%',
  isVisible: true,
  portalTarget: undefined,
}

export default Overlay

