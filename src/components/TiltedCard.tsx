import type { SpringOptions } from 'motion/react';
import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
} from 'motion/react';

interface TiltedCardProps {
  children: React.ReactNode;
  className?: string;
  rotateAmplitude?: number;
  scaleOnHover?: number;
}

const springValues: SpringOptions = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

export default function TiltedCard({
  children,
  className = '',
  rotateAmplitude = 5,
  scaleOnHover = 1.025,
}: TiltedCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(
    useMotionValue(0),
    springValues,
  );

  const rotateY = useSpring(
    useMotionValue(0),
    springValues,
  );

  const scale = useSpring(
    1,
    springValues,
  );

  function handleMouse(
    e: React.MouseEvent<HTMLDivElement>,
  ) {
    if (!ref.current) return;

    const rect =
      ref.current.getBoundingClientRect();

    const offsetX =
      e.clientX -
      rect.left -
      rect.width / 2;

    const offsetY =
      e.clientY -
      rect.top -
      rect.height / 2;

    const rotationX =
      (offsetY / (rect.height / 2)) *
      -rotateAmplitude;

    const rotationY =
      (offsetX / (rect.width / 2)) *
      rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);

    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <div
      ref={ref}
      className={`
        relative
        w-full
        [perspective:1000px]
        ${className}
      `}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="
          relative
          w-full
          [transform-style:preserve-3d]
        "
        style={{
          rotateX,
          rotateY,
          scale,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}