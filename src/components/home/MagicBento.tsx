import React, { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

export interface MagicBentoCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  accent?: string;
  onClick?: () => void;
}

/**
 * Lightweight Magic Bento-style interaction for Pathana Shakthi.
 * Keeps the existing card content/layout intact while adding:
 * - cursor-following glow
 * - tiny floating particles on hover
 * - click ripple
 * - very subtle magnetic movement
 */
export const MagicBentoCard: React.FC<MagicBentoCardProps> = ({
  children,
  className = '',
  glowColor = '255, 184, 77',
  accent = '#ffb84d',
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onClick);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const particles: HTMLElement[] = Array.from({ length: 8 }, () => {
      const particle = document.createElement('span');
      particle.className = 'magic-bento-particle';
      particle.style.background = accent;
      particle.style.boxShadow = `0 0 9px rgba(${glowColor}, .55)`;
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.opacity = '0';
      card.appendChild(particle);
      return particle;
    });

    const move = (event: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const px = (x / rect.width) * 100;
      const py = (y / rect.height) * 100;

      card.style.setProperty('--magic-x', `${px}%`);
      card.style.setProperty('--magic-y', `${py}%`);
      card.style.setProperty('--magic-glow', '1');

      // Intentionally tiny: the existing page already has SpotlightCard tilt.
      const dx = (x - rect.width / 2) * 0.006;
      const dy = (y - rect.height / 2) * 0.006;
      card.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    };

    const enter = () => {
      card.style.setProperty('--magic-glow', '1');

      animate(particles, {
        opacity: [0, 0.75, 0],
        translateX: () => (Math.random() - 0.5) * 52,
        translateY: () => (Math.random() - 0.5) * 52,
        scale: [0.5, 1, 0],
        duration: 1000,
        delay: stagger(55),
        easing: 'easeOutQuad',
      });
    };

    const leave = () => {
      card.style.setProperty('--magic-glow', '0');
      card.style.transform = 'translate3d(0, 0, 0)';
      particles.forEach((particle) => {
        particle.style.opacity = '0';
      });
    };

    const click = (event: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const ripple = document.createElement('span');
      ripple.className = 'magic-bento-ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.background = `radial-gradient(circle, rgba(${glowColor}, .25) 0%, rgba(${glowColor}, .08) 34%, transparent 72%)`;
      card.appendChild(ripple);

      animate(ripple, {
        scale: [0, 1],
        opacity: [1, 0],
        duration: 600,
        easing: 'easeOutCubic',
        complete: () => ripple.remove(),
      });

      onClickRef.current?.();
    };

    card.addEventListener('mousemove', move);
    card.addEventListener('mouseenter', enter);
    card.addEventListener('mouseleave', leave);
    card.addEventListener('click', click);

    return () => {
      card.removeEventListener('mousemove', move);
      card.removeEventListener('mouseenter', enter);
      card.removeEventListener('mouseleave', leave);
      card.removeEventListener('click', click);
      particles.forEach((particle) => particle.remove());
    };
  }, [accent, glowColor]);

  return (
    <>
      <style>{`
        .magic-bento-card {
          --magic-x: 50%;
          --magic-y: 50%;
          --magic-glow: 0;
          --magic-accent: #ffb84d;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transform: translate3d(0, 0, 0);
          transition: transform 180ms ease, box-shadow 220ms ease;
          will-change: transform;
        }

        .magic-bento-card::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          border-radius: inherit;
          opacity: var(--magic-glow);
          background: radial-gradient(
            circle 150px at var(--magic-x) var(--magic-y),
            rgba(var(--magic-accent-rgb, 255, 184, 77), 0.16),
            transparent 72%
          );
          transition: opacity 180ms ease;
        }

        .magic-bento-particle {
          position: absolute;
          z-index: 1;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          pointer-events: none;
          transform: translate3d(0, 0, 0) scale(0.5);
        }

        .magic-bento-ripple {
          position: absolute;
          z-index: 2;
          width: 180px;
          height: 180px;
          border-radius: 999px;
          pointer-events: none;
          transform: translate(-50%, -50%) scale(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .magic-bento-card {
            transition: none;
          }
        }
      `}</style>

      <div
        ref={cardRef}
        className={`magic-bento-card ${className}`}
        style={
          {
            '--magic-x': '50%',
            '--magic-y': '50%',
            '--magic-glow': '0',
            '--magic-accent': accent,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </>
  );
};

export default MagicBentoCard;
