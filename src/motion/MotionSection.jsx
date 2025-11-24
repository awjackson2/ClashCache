import PropTypes from 'prop-types'
import { motion } from 'framer-motion'
import { motionVariants } from './variants'

function MotionSection({ variantGroup, variant, as = 'div', children, ...motionProps }) {
  const MotionComponent = motion[as] ?? motion.div
  const group = variantGroup ? motionVariants[variantGroup] : null
  const resolvedVariant = group && variant ? group[variant] : null

  const finalProps = { ...motionProps }

  if (resolvedVariant) {
    finalProps.initial ??= resolvedVariant.initial
    finalProps.animate ??= resolvedVariant.animate
    finalProps.exit ??= resolvedVariant.exit
    finalProps.transition ??= resolvedVariant.transition
  }

  return <MotionComponent {...finalProps}>{children}</MotionComponent>
}

MotionSection.propTypes = {
  variantGroup: PropTypes.string,
  variant: PropTypes.string,
  as: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  children: PropTypes.node,
}

export default MotionSection

