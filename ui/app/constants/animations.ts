export const ANIM_DURATION = 0.25;
export const ANIM_EASING = [0.4, 0, 0.2, 1] as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: ANIM_DURATION, ease: ANIM_EASING },
};

export const fadeScale = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: ANIM_DURATION, ease: ANIM_EASING },
};

export const fadeElement = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: ANIM_DURATION, ease: ANIM_EASING },
  style: { overflow: 'hidden' },
};

export const chipCollapse = {
  initial: { opacity: 0, overflow: 'hidden' as const },
  animate: {
    opacity: 1,
    height: 'auto',
    overflow: 'hidden' as const,
    transitionEnd: { overflow: 'visible' as const },
  },
  exit: { opacity: 0, overflow: 'hidden' as const },
  transition: { duration: ANIM_DURATION, ease: ANIM_EASING },
};

export const expandCollapse = {
  initial: { opacity: 0, height: 0, overflow: 'hidden' as const },
  animate: {
    opacity: 1,
    height: 'auto',
    overflow: 'hidden' as const,
    transitionEnd: { overflow: 'visible' as const },
  },
  exit: { opacity: 0, height: 0, overflow: 'hidden' as const },
  transition: { duration: ANIM_DURATION, ease: ANIM_EASING },
};