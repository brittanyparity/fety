/**
 * Dashboard widget position lock icons from The Noun Project.
 * Active pair: pin (unlocked) + pinned (locked). Additional variants kept in assets for future UI.
 *
 * @see https://thenounproject.com/icon/pin-8477301/
 * @see https://thenounproject.com/icon/pin-8478551/
 * @see https://thenounproject.com/icon/pin-8285897/
 * @see https://thenounproject.com/icon/pinned-8285888/
 * @see https://thenounproject.com/icon/unpin-1856568/
 * @see https://thenounproject.com/icon/unpin-1856571/
 */
import pinIcon from "../assets/icons/noun/pin-8477301.png";
import pinnedIcon from "../assets/icons/noun/pinned-8285888.png";

type WidgetPinIconProps = {
  locked: boolean;
  size?: number;
  /** When true, inverts for dark button backgrounds (locked state). */
  onDark?: boolean;
};

export default function WidgetPinIcon({ locked, size = 16, onDark = false }: WidgetPinIconProps) {
  const src = locked ? pinnedIcon : pinIcon;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      style={{
        display: "block",
        width: size,
        height: size,
        objectFit: "contain",
        filter: onDark ? "brightness(0) invert(1)" : undefined,
        opacity: locked ? 1 : 0.85,
      }}
    />
  );
}
