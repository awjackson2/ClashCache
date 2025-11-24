const easeOutExpo = [0.24, 0.8, 0.35, 1]

const pageTransition = {
  duration: 0.45,
  ease: easeOutExpo,
}

const overlayTransition = {
  duration: 0.8,
  ease: easeOutExpo,
}

export const pageVariants = {
  slideFade: {
    initial: { opacity: 0, x: '10vw' },
    animate: {
      opacity: 1,
      x: '0vw',
      transition: pageTransition,
    },
    exit: {
      opacity: 0,
      x: '-10vw',
      transition: { ...pageTransition, when: 'afterChildren' },
    },
  },
}

export const overlayVariants = {
  slideFromRight: {
    initial: { opacity: 0, x: '100%' },
    animate: { opacity: 1, x: '0%' },
    exit: { opacity: 0, x: '100%' },
    transition: overlayTransition,
  },
  slideFromLeft: {
    initial: { opacity: 0, x: '-100%' },
    animate: { opacity: 1, x: '0%' },
    exit: { opacity: 0, x: '-100%' },
    transition: overlayTransition,
  },
  slideFromTop: {
    initial: { opacity: 0, y: '-100%' },
    animate: { opacity: 1, y: '0%' },
    exit: { opacity: 0, y: '-100%' },
    transition: overlayTransition,
  },
  slideFromBottom: {
    initial: { opacity: 0, y: '100%' },
    animate: { opacity: 1, y: '0%' },
    exit: { opacity: 0, y: '100%' },
    transition: overlayTransition,
  },
}

// When adding new variants, pair the consuming component with `useExitParticipant`
// (see `ExitAnimationCoordinator`) so it can report exit completion to coordinated transitions.
export const motionVariants = {
  page: pageVariants,
  overlay: overlayVariants,
}

export const motionConfig = {
  easings: {
    easeOutExpo,
  },
  transitions: {
    page: pageTransition,
    overlay: overlayTransition,
  },
}

