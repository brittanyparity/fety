/**
 * Thumbtack pin icons from Tabler Icons (MIT).
 * @see https://tabler.io/icons/icon/pin
 * @see https://tabler.io/icons/icon/pinned
 */

type WidgetPinIconProps = {
  locked: boolean;
  size?: number;
  color?: string;
};

export default function WidgetPinIcon({ locked, size = 16, color = "currentColor" }: WidgetPinIconProps) {
  const stroke = color;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (locked) {
    return (
      <svg {...common}>
        <path d="M9 4v6l-2 4v2h10v-2l-2 -4v-6" />
        <path d="M12 16l0 5" />
        <path d="M8 4l8 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4" />
      <path d="M9 15l-4.5 4.5" />
      <path d="M14.5 4l5.5 5.5" />
    </svg>
  );
}
