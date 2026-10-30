import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  Chess,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";
import { ChessSquare } from "./ChessSquare";
import type { OverlayColor } from "../overlay/colors";

type ChessBoardProps = {
  game: Chess;
  role: "w" | "b" | "spectator";
  onMove: (
    from: Square,
    to: Square,
    promotion?: PieceSymbol
  ) => void;
};

type ArrowAnnotation = {
  from: Square;
  to: Square;
  color: OverlayColor;
};

type SquareAnnotation = {
  square: Square;
  color: OverlayColor;
};

type DragStart = {
  square: Square;
  color: OverlayColor;
  pointerId: number;
};

const pieceNames: Record<string, string> = {
  K: "white-king",
  Q: "white-queen",
  R: "white-rook",
  B: "white-bishop",
  N: "white-knight",
  P: "white-pawn",
  k: "black-king",
  q: "black-queen",
  r: "black-rook",
  b: "black-bishop",
  n: "black-knight",
  p: "black-pawn",
};

const files = "abcdefgh";

function getColorFromPointer(
  event: PointerEvent<HTMLButtonElement>
): OverlayColor {
  // For simultaneous modifiers, Ctrl takes priority over Shift,
  // which takes priority over Alt.
  if (event.ctrlKey) return "control";
  if (event.shiftKey) return "shift";
  if (event.altKey) return "alt";
  return "default";
}

function squareKey(square: Square, color: OverlayColor) {
  return `${square}:${color}`;
}

function arrowKey(
  from: Square,
  to: Square,
  color: OverlayColor
) {
  return `${from}:${to}:${color}`;
}

export function ChessBoard({
  game,
  role,
  onMove,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] =
    useState<Move[] | null>(null);

  const [arrows, setArrows] = useState<ArrowAnnotation[]>([]);
  const [highlights, setHighlights] =
    useState<SquareAnnotation[]>([]);

  const dragStart = useRef<DragStart | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Clear local annotations when the opponent makes a move.
  // For spectators, every played move clears their annotations.
  useEffect(() => {
    const history = game.history({ verbose: true });
    const lastMove = history[history.length - 1];

    if (
      lastMove &&
      (role === "spectator" || lastMove.color !== role)
    ) {
      setArrows([]);
      setHighlights([]);
    }
  }, [game, role]);

  const board = game.board();

  const legalMoves: Move[] = selected
    ? game.moves({ square: selected, verbose: true })
    : [];

  function clearAnnotations() {
    setArrows([]);
    setHighlights([]);
  }

  function handleSquareClick(square: Square) {
    // Clear annotations when a player clicks one of their pieces,
    // even when it is not currently their turn.
    const clickedPiece = game.get(square);

    if (
      clickedPiece &&
      role !== "spectator" &&
      clickedPiece.color === role
    ) {
      clearAnnotations();
    }

    if (game.isGameOver() || pendingPromotion) return;

    const piece = game.get(square);

    if (piece && piece.color === game.turn()) {
      setSelected(square);
      return;
    }

    const candidates = legalMoves.filter(
      (move) => move.to === square
    );

    if (candidates.length > 1) {
      setPendingPromotion(candidates);
      return;
    }

    if (candidates.length === 1 && selected) {
      const move = candidates[0];

      onMove(move.from, move.to, move.promotion);
      setSelected(null);
      return;
    }

    setSelected(null);
  }

  function handlePointerDown(
    square: Square,
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 2) return;

    event.preventDefault();

    dragStart.current = {
      square,
      color: getColorFromPointer(event),
      pointerId: event.pointerId,
    };
  }

  function handlePointerUp(
    square: Square,
    event: PointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 2) return;

    event.preventDefault();

    const start = dragStart.current;

    if (!start || start.pointerId !== event.pointerId) return;

    dragStart.current = null;

    if (start.square === square) {
      const key = squareKey(square, start.color);

      setHighlights((previous) =>
        previous.some(
          (item) =>
            squareKey(item.square, item.color) === key
        )
          ? previous.filter(
              (item) =>
                squareKey(item.square, item.color) !== key
            )
          : [...previous, { square, color: start.color }]
      );

      return;
    }

    const key = arrowKey(start.square, square, start.color);

    setArrows((previous) =>
      previous.some(
        (item) =>
          arrowKey(item.from, item.to, item.color) === key
      )
        ? previous.filter(
            (item) =>
              arrowKey(item.from, item.to, item.color) !== key
          )
        : [
            ...previous,
            {
              from: start.square,
              to: square,
              color: start.color,
            },
          ]
    );
  }

  function choosePromotion(move: Move) {
    onMove(move.from, move.to, move.promotion);
    setPendingPromotion(null);
    setSelected(null);
  }

  function squareCenter(square: Square) {
    const file = files.indexOf(square[0]);
    const rank = Number(square[1]);

    return {
      x: ((file + 0.5) / 8) * 100,
      y: ((8 - rank + 0.5) / 8) * 100,
    };
  }

  return (
    <div>
      <div
        className="chess-board-container"
        ref={boardRef}
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        <div className="chess-board">
          {board.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const square =
                `${files[colIndex]}${8 - rowIndex}` as Square;

              const pieceName = piece
                ? pieceNames[
                    piece.color === "w"
                      ? piece.type.toUpperCase()
                      : piece.type
                  ]
                : null;

              const destinationMoves = legalMoves.filter(
                (move) => move.to === square
              );

              const highlight = highlights.find(
                (item) => item.square === square
              );

              return (
                <ChessSquare
                  key={square}
                  square={square}
                  piece={pieceName}
                  isLight={(rowIndex + colIndex) % 2 === 0}
                  isSelected={selected === square}
                  isLegalMove={destinationMoves.length > 0}
                  isCapture={destinationMoves.some(
                    (move) => Boolean(move.captured)
                  )}
                  highlightColor={highlight?.color ?? null}
                  onClick={() => handleSquareClick(square)}
                  onPointerDown={(event) =>
                    handlePointerDown(square, event)
                  }
                  onPointerUp={(event) =>
                    handlePointerUp(square, event)
                  }
                />
              );
            })
          )}
        </div>

        <svg
  className="annotation-arrows"
  viewBox="0 0 800 800"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <defs>
    {(
      [
        ["default", "#f5df42"],
        ["control", "#e74c3c"],
        ["shift", "#3498db"],
        ["alt", "#2ecc71"],
      ] as const
    ).map(([name, color]) => (
      <marker
        key={name}
        id={`arrow-head-${name}`}
        markerUnits="userSpaceOnUse"
        markerWidth="28"
        markerHeight="28"
        refX="25"
        refY="14"
        orient="auto"
        viewBox="0 0 28 28"
      >
        <path
          d="M 0 0 L 28 14 L 0 28 Z"
          fill={color}
        />
      </marker>
    ))}
  </defs>

  {arrows.map((arrow) => {
    const start = squareCenter(arrow.from);
    const end = squareCenter(arrow.to);

    const colors = {
      default: "#f5df42",
      control: "#e74c3c",
      shift: "#3498db",
      alt: "#2ecc71",
    };

    return (
      <line
        key={arrowKey(arrow.from, arrow.to, arrow.color)}
        x1={start.x * 8}
        y1={start.y * 8}
        x2={end.x * 8}
        y2={end.y * 8}
        stroke={colors[arrow.color]}
        strokeWidth="10"
        strokeOpacity="0.5"
        strokeLinecap="round"
        markerEnd={`url(#arrow-head-${arrow.color})`}
      />
    );
  })}
</svg>
      </div>

      {pendingPromotion && (
        <div className="promotion-panel">
          <p>Promote your pawn to:</p>

          {pendingPromotion.map((move) => (
            <button
              key={move.promotion}
              type="button"
              onClick={() => choosePromotion(move)}
            >
              {move.promotion === "q" && "Queen"}
              {move.promotion === "r" && "Rook"}
              {move.promotion === "b" && "Bishop"}
              {move.promotion === "n" && "Knight"}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPendingPromotion(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}