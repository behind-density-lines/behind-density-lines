import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { clamp } from "three/src/math/MathUtils.js";
import {
  ClientState,
  applyDrawEventClient,
  DrawEvent,
  DrawResponse,
  DrawType,
  FloodFillResponse,
  drawClient,
  drawImage,
  floodFillClient,
} from "drawing";
import { useSocket } from "../socket-connection";

/**
 * Processes user input, updates the drawing texture uniforms and emits draw events to
 * the server.
 */
export function PainterController(props: {
  historyIndex: number;
  imageIndex: number;
  zoom: number;
  numFingers: number;
  pan: readonly [number, number];
  cursorDown: boolean;
  state: ClientState;
  drawType: DrawType;
  brushSize: number;
}): null {
  // current pointer position in screen coordinate system ([-1, -1] to [1, 1] with the origin
  // at the center of the screen)
  const { pointer } = useThree();

  // the last cursor position in texture coordinates ([0, 0] at the bottom left corner and,
  // and [resolution[0], resolution[1]] at the top right corner), or null if the cursor is
  // not down.
  const [, setLastCursorPos] = useState<readonly [number, number] | null>(null);

  // the socket connection to the server, or null if the connection has not been established.
  const socket = useSocket();

  // controls whether or not reconcilliation of our local state with the server state is complete.
  // user input should be disabled until this is true.
  const [reconciling, setReconciling] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const [latestHistoryIndex, setLatestHistoryIndex] = useState(
    props.historyIndex
  );

  // listen for draw events from the server
  useEffect((): any => {
    if (socket && socket.connected) {
      socket.on(
        "draw",
        (data: {
          draw: Omit<DrawResponse, "historyIndex">;
          fills: FloodFillResponse[];
        }) => {
          props.state.nextSegmentIndex = Math.max(
            props.state.nextSegmentIndex,
            data.draw.segment + 1
          );
          applyDrawEventClient(props.state, data.draw, true);

          for (const fill of data.fills) {
            props.state.nextSegmentIndex = Math.max(
              props.state.nextSegmentIndex,
              fill.segment + 1
            );
          }
          floodFillClient(props.state, data.fills, true);

          setLatestHistoryIndex((latestHistoryIndex) => latestHistoryIndex + 1);
        }
      );
      socket.on("disconnect", () => {
        setReconciled(false);
        setReconciling(false);
      });
      socket.emit("join", {
        room: props.imageIndex.toString(),
      });
      setReconciling(true);
      return () => socket.off("draw");
    }
  }, [socket, props.state, props.imageIndex, setReconciling]);

  useEffect(() => {
    if (socket && socket.connected && reconciling && !reconciled) {
      fetch(
        `/api/log?imageIndex=${props.imageIndex}&historyIndex=${latestHistoryIndex}`,
        { cache: "no-cache" }
      )
        .then((res) => res.json())
        .then((res) => {
          for (const eventData of res.initialState) {
            drawClient(props.state, eventData, false);
            setLatestHistoryIndex(eventData.historyIndex);
          }
          drawImage(props.state);

          setReconciled(true);
          setReconciling(false);
        });
    }
  }, [
    socket,
    latestHistoryIndex,
    props.imageIndex,
    props.state,
    reconciling,
    setLatestHistoryIndex,
    setReconciling,
    setReconciled,
    reconciled,
  ]);

  // handle updates on each frame
  return useFrame(() => {
    // if the cursor is down and reconcilliation is done, allow drawing
    if (props.numFingers < 2 && props.cursorDown && socket && reconciled) {
      // gets the pixel position of the cursor in texture coordinates ([0, 0] at the bottom left corner and,
      // and [resolution[0], resolution[1]] at the top right corner)
      const getPixelPos = (
        pointerPos: number,
        pan: number,
        resolutionDim: number,
        windowDim: number
      ) =>
        Math.floor(
          ((pointerPos * windowDim) / 2 - pan) / props.zoom + resolutionDim / 2
        );

      // the pixel position of the cursor in texture coordinates
      const pixelPos = [
        getPixelPos(
          pointer.x,
          props.pan[0],
          props.state.resolution[0],
          window.innerWidth
        ),
        getPixelPos(
          pointer.y,
          -props.pan[1],
          props.state.resolution[1],
          window.innerHeight
        ),
      ] as const;

      // update the last cursor position
      setLastCursorPos((lastCursor) => {
        if (lastCursor) {
          if (
            (lastCursor[0] === pixelPos[0] && lastCursor[1] === pixelPos[1]) ||
            ((lastCursor[0] < 0 ||
              lastCursor[1] < 0 ||
              lastCursor[0] >= props.state.resolution[0] ||
              lastCursor[1] >= props.state.resolution[1]) &&
              (pixelPos[0] < 0 ||
                pixelPos[1] < 0 ||
                pixelPos[0] >= props.state.resolution[0] ||
                pixelPos[1] >= props.state.resolution[1]))
          ) {
            // if the cursor has not moved or it moved off-screen, do nothing
            return lastCursor;
          }
        }

        function clampPos(pos: readonly [number, number]) {
          return [
            clamp(pos[0], 0, props.state.resolution[0] - 1),
            clamp(pos[1], 0, props.state.resolution[1] - 1),
          ] as const;
        }

        const drawEvent: DrawEvent = {
          from: clampPos(lastCursor ?? pixelPos),
          to: clampPos(pixelPos),
          type: props.drawType,
          size: props.brushSize,
        };

        if (
          drawEvent.from[0] !== drawEvent.to[0] ||
          drawEvent.from[1] !== drawEvent.to[1]
        ) {
          // emit the draw event to the server
          socket.emit("draw", drawEvent);
        }

        // update the last cursor position
        return pixelPos;
      });
    } else {
      // if the cursor is not down, set the last cursor position to null
      setLastCursorPos(null);
    }
  });
}
