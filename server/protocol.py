"""Binary frame encoding + JSON message schemas.

Disambiguation on the wire: JSON strings = control/stats; binary bytes = state
frames. Grid data is ALWAYS binary, never JSON. Little-endian throughout.

State frame layout:
  header: magic(u16) tick(u32) W(u16) H(u16) B(u8) flags(u8)
  payload: state[B*H*W] (u8)  then  oxygen_q[B*H*W] (u8, O quantized 0..255)
  optional (flags & FLAG_FOCUS): focusX(u16) focusY(u16) attn[9] (f16)
"""

from __future__ import annotations

import struct

import numpy as np

MAGIC = 0xCA77
FLAG_FOCUS = 0x01

_HEADER = struct.Struct("<HIHHBB")  # magic, tick, W, H, B, flags


def encode_frame(tick: int, state: np.ndarray, oxygen: np.ndarray,
                 focus: tuple | None = None) -> bytes:
    """state: [B,H,W] uint8, oxygen: [B,H,W] float32 in [0,1].
    focus: optional (x, y, attn9 float array)."""
    B, H, W = state.shape
    flags = FLAG_FOCUS if focus is not None else 0
    parts = [_HEADER.pack(MAGIC, tick & 0xFFFFFFFF, W, H, B, flags)]

    parts.append(np.ascontiguousarray(state, dtype=np.uint8).tobytes())
    oq = np.clip(oxygen, 0.0, 1.0)
    oq = (oq * 255.0 + 0.5).astype(np.uint8)
    parts.append(np.ascontiguousarray(oq).tobytes())

    if focus is not None:
        fx, fy, attn = focus
        parts.append(struct.pack("<HH", int(fx), int(fy)))
        parts.append(np.ascontiguousarray(attn, dtype=np.float16).tobytes())

    return b"".join(parts)


# --- JSON message type names (for reference / validation) ---
CLIENT_MESSAGES = {
    "set_params", "reset", "play", "pause", "set_speed",
    "spawn", "focus", "split", "sweep", "preset",
}

SERVER_MESSAGES = {"stats", "sweep_result", "hello", "ack"}
