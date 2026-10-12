// Adapted from React Bits AnimatedContent by David Haz; see react-bits-LICENSE.txt.
import { useLayoutEffect, useRef } from 'react';
import type { HTMLAttributes } from 'react';
import { gsap } from 'gsap';

interface AnimatedContentProps extends HTMLAttributes<HTMLDivElement> {
  delay?: number;
  distance?: number;
}

export function AnimatedContent({ children, delay = 0, distance = 18, ...props }: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const tween = gsap.fromTo(el, { y: distance, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.55, delay, ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      const finish = () => { tween.progress(1); };
      el.addEventListener('pointerdown', finish, true);
      el.addEventListener('focusin', finish, true);
      window.addEventListener('beforeprint', finish);
      return () => {
        el.removeEventListener('pointerdown', finish, true);
        el.removeEventListener('focusin', finish, true);
        window.removeEventListener('beforeprint', finish);
      };
    });
    return () => media.revert();
  }, [delay, distance]);
  return <div ref={ref} data-animated-content {...props}>{children}</div>;
}
