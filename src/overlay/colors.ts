export type OverlayColor = "default" | "control" | "shift" | "alt";

export const overlayColors: Record<
  OverlayColor | `${OverlayColor}_dark`,
  string
> = {
  default: "#f5df42",
  default_dark: "#b6a82d",

  control: "#e74c3c",
  control_dark: "#a92d27",

  shift: "#3498db",
  shift_dark: "#22618e",

  alt: "#2ecc71",
  alt_dark: "#218c4b",
};

export function getOverlayColor(
  color: OverlayColor,
  isLightSquare: boolean
): string {
  return overlayColors[
    isLightSquare ? color : `${color}_dark`
  ];
}