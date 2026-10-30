import { defaultTheme } from "../themes/defaultTheme";
import {
  getOverlayColor,
  type OverlayColor,
} from "../overlay/colors";
import type { PointerEvent } from "react";

const pieceSymbols: Record<string, string> = {
  "white-king": "♔",
  "white-queen": "♕",
  "white-rook": "♖",
  "white-bishop": "♗",
  "white-knight": "♘",
  "white-pawn": "♙",
  "black-king": "♚",
  "black-queen": "♛",
  "black-rook": "♜",
  "black-bishop": "♝",
  "black-knight": "♞",
  "black-pawn": "♟",
};

type ChessSquareProps = {
  square: string;
  piece: string | null;
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isCapture: boolean;
  highlightColor: OverlayColor | null;
  onClick: () => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function ChessSquare({
  square,
  piece,
  isLight,
  isSelected,
  isLegalMove,
  isCapture,
  highlightColor,
  onClick,
  onPointerDown,
  onPointerUp,
}: ChessSquareProps) {
  const squareTexture = isLight
    ? defaultTheme.squares.light
    : defaultTheme.squares.dark;

  const highlightStyle = highlightColor
    ? {
        backgroundColor: getOverlayColor(highlightColor, isLight),
      }
    : undefined;

  return (
    <button
      type="button"
      className={`square ${isLight ? "light" : "dark"} ${
        isSelected ? "selected" : ""
      }`}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      aria-label={`${square}${piece ? `, ${piece}` : ""}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <img
        className="square-texture"
        src={squareTexture}
        alt=""
        draggable={false}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      {highlightColor && (
        <span
          className="square-highlight"
          style={highlightStyle}
          aria-hidden="true"
        />
      )}

      {piece && (
        <>
          <span
            className={`piece-fallback ${
              piece.startsWith("white-")
                ? "white-piece"
                : "black-piece"
            }`}
            aria-hidden="true"
          >
            {pieceSymbols[piece]}
          </span>

          <img
            className="piece-texture"
            src={
              defaultTheme.pieces[
                piece as keyof typeof defaultTheme.pieces
              ]
            }
            alt={piece}
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        </>
      )}

      {isLegalMove && (
        <span
          className={isCapture ? "legal-ring" : "legal-dot"}
          aria-hidden="true"
        />
      )}
    </button>
  );
}