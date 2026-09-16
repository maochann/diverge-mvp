import Svg, { Path } from 'react-native-svg';

interface ForkLineProps {
  /** Total width of the mark. */
  width?: number;
  color: string;
  /** Stroke thickness. */
  thickness?: number;
}

/**
 * Diverge's one motif: a line that splits. Used only where something
 * actually branches — the selected intent, a chapter boundary — never as
 * decoration.
 *
 *      ___/
 *   __/
 */
export function ForkLine({ width = 28, color, thickness = 1.5 }: ForkLineProps) {
  const h = 10;
  const split = width * 0.45;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} accessibilityElementsHidden>
      <Path
        d={`M0 ${h - 1} H${split} M${split} ${h - 1} L${split + 6} 1 H${width}`}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
