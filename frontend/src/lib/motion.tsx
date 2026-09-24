/**
 * Motion primitives for the public site.
 * Every animated surface goes through these so timing, easing and reduced-motion handling stay consistent.
 */
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import { useLocation } from "react-router-dom";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  fast: 0.35,
  base: 0.7,
  slow: 1.1,
} as const;

/** Default viewport trigger: fire once, when ~18% of the element is visible. */
export const VIEWPORT = { once: true, amount: 0.18, margin: "0px 0px -8% 0px" } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

export const staggerContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Returns variants that collapse to "no motion" when the user prefers reduced motion. */
export function useMotionVariants(variants: Variants): Variants {
  const reduce = useReducedMotion();
  if (!reduce) return variants;
  return {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { duration: 0 } },
  };
}

type RevealProps = Omit<HTMLMotionProps<"div">, "variants" | "initial" | "whileInView" | "viewport"> & {
  as?: ElementType;
  variants?: Variants;
  delay?: number;
  /** Amount of the element that must be visible before the reveal fires. */
  amount?: number;
  children?: ReactNode;
};

/**
 * Scroll reveal. Animates once when the element enters the viewport.
 * Usage: <Reveal className="..."><h2>…</h2></Reveal>
 */
export function Reveal({ as = "div", variants = fadeUp, delay = 0, amount, children, ...rest }: RevealProps) {
  const reduce = useReducedMotion();
  const Component = (motion as unknown as Record<string, typeof motion.div>)[as as string] ?? motion.div;
  const safe = reduce ? { hidden: { opacity: 1 }, visible: { opacity: 1 } } : variants;

  return (
    <Component
      variants={safe}
      initial="hidden"
      whileInView="visible"
      viewport={{ ...VIEWPORT, amount: amount ?? VIEWPORT.amount }}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </Component>
  );
}

type StaggerProps = Omit<HTMLMotionProps<"div">, "variants" | "initial" | "whileInView" | "viewport"> & {
  as?: ElementType;
  stagger?: number;
  delay?: number;
  amount?: number;
  /** Animate on mount instead of on scroll (hero entrances). */
  immediate?: boolean;
  children?: ReactNode;
};

/**
 * Staggered children reveal. Wrap children in <StaggerItem>.
 */
export function Stagger({
  as = "div",
  stagger = 0.08,
  delay = 0,
  amount,
  immediate = false,
  children,
  ...rest
}: StaggerProps) {
  const reduce = useReducedMotion();
  const Component = (motion as unknown as Record<string, typeof motion.div>)[as as string] ?? motion.div;
  const container = reduce ? { hidden: {}, visible: {} } : staggerContainer(stagger, delay);

  return (
    <Component
      variants={container}
      initial="hidden"
      {...(immediate ? { animate: "visible" } : { whileInView: "visible", viewport: { ...VIEWPORT, amount: amount ?? VIEWPORT.amount } })}
      {...rest}
    >
      {children}
    </Component>
  );
}

type StaggerItemProps = Omit<HTMLMotionProps<"div">, "variants"> & {
  as?: ElementType;
  variants?: Variants;
  children?: ReactNode;
};

export function StaggerItem({ as = "div", variants = fadeUp, children, ...rest }: StaggerItemProps) {
  const safe = useMotionVariants(variants);
  const Component = (motion as unknown as Record<string, typeof motion.div>)[as as string] ?? motion.div;
  return (
    <Component variants={safe} {...rest}>
      {children}
    </Component>
  );
}

/** Route-change fade. Wrap <Outlet /> with this. */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.22, ease: EASE_IN_OUT } }}
        transition={{ duration: 0.45, ease: EASE_OUT }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Image wrapper with a slow hover scale. Use for gallery tiles and cards. */
export function HoverScale({
  children,
  className = "",
  scale = 1.04,
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { scale }}
      transition={{ duration: 0.9, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion, useReducedMotion };
